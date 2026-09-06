import test from 'node:test';
import assert from 'node:assert/strict';
import { exec } from '../../../src/machine/commands.js';
import { TextBuffer } from '../../../src/screen/text-buffer.js';
import { createMachine } from '../../../src/machine/state.js';
import * as content from '../../../src/content/index.js';
import { LTGREEN, LTRED } from '../../../src/text/palette.js';

/** A ctx whose every side effect is recorded instead of performed. */
function ctxFor(cols = 40) {
  const buffer = new TextBuffer(cols, 25);
  const machine = createMachine();
  machine.mode = 'app';
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  return {
    buffer,
    machine,
    content,
    calls,
    snd: { beep: record('beep'), noise: record('noise') },
    coldStart: record('coldStart'),
    startMaze: record('startMaze'),
    launch: record('launch'),
    openLink: record('openLink'),
  };
}

const names = (ctx) => ctx.calls.map((c) => c[0]);

test('POKE 53280 sets the border and 53281 the background', () => {
  const ctx = ctxFor();
  exec('POKE 53280,2', ctx);
  assert.equal(ctx.buffer.border, 2);
  assert.equal(ctx.machine.status, 'OK.');
  assert.equal(ctx.machine.statusCol, LTGREEN);
  exec('poke 53281 , 5', ctx);
  assert.equal(ctx.buffer.bg, 5);
});

test('POKE clamps the value to four bits', () => {
  const ctx = ctxFor();
  exec('POKE 53280,17', ctx);
  assert.equal(ctx.buffer.border, 1);
  exec('POKE 53281,255', ctx);
  assert.equal(ctx.buffer.bg, 15);
});

test('SYS 64738 cold starts', () => {
  const ctx = ctxFor();
  exec('SYS 64738', ctx);
  assert.deepEqual(names(ctx), ['coldStart']);
  exec('sys64738', ctx);
  assert.deepEqual(names(ctx), ['coldStart', 'coldStart']);
});

test('10 PRINT and MAZE start the maze', () => {
  for (const cmd of ['10 PRINT', '10PRINT', 'MAZE', '10 print chr$(205.5)']) {
    const ctx = ctxFor();
    exec(cmd, ctx);
    assert.deepEqual(names(ctx), ['startMaze'], cmd);
  }
});

test('HELP, ABOUT, LIST and DIR set their page and draw it', () => {
  for (const [cmd, page, needle] of [
    ['HELP', 'help', 'THE OMARCHY/64 COMMAND SET'],
    ['?', 'help', 'THE OMARCHY/64 COMMAND SET'],
    ['ABOUT', 'about', 'OMARCHY IS BEAUTIFUL'],
    ['NEOFETCH', 'about', 'OMARCHY IS BEAUTIFUL'],
    ['LIST', 'list', '10 PRINT "OMARCHY"'],
    ['DIR', 'dir', '"MANUAL"'],
    ['LOAD"$"', 'dir', '"MANUAL"'],
  ]) {
    const ctx = ctxFor();
    exec(cmd, ctx);
    assert.equal(ctx.machine.page, page, cmd);
    assert.ok(ctx.buffer.text().join('\n').includes(needle), `${cmd} should show ${needle}`);
  }
});

test('DIR whirrs the drive', () => {
  const ctx = ctxFor();
  exec('DIR', ctx);
  assert.ok(names(ctx).includes('noise'));
});

test('RUN and its aliases go back to the menu', () => {
  for (const cmd of ['RUN', 'MENU', 'HOME', 'CLR', 'CLS']) {
    const ctx = ctxFor();
    ctx.machine.page = 'doc';
    exec(cmd, ctx);
    assert.equal(ctx.machine.page, 'menu', cmd);
  }
});

test('a number from 1 to 14 launches that entry', () => {
  for (const n of [1, 6, 14]) {
    const ctx = ctxFor();
    exec(String(n), ctx);
    assert.equal(ctx.machine.sel, n - 1);
    assert.deepEqual(ctx.calls, [['launch', n - 1]]);
  }
});

test('0 and 15 are not menu entries', () => {
  for (const n of ['0', '15', '99']) {
    const ctx = ctxFor();
    exec(n, ctx);
    assert.equal(ctx.machine.status, '?SYNTAX  ERROR');
  }
});

test('an exact name launches, and so does a prefix of three or more', () => {
  const ctx = ctxFor();
  exec('WORKSTATIONS', ctx);
  assert.deepEqual(ctx.calls[0], ['launch', 12]);
  const p = ctxFor();
  exec('sec', p);
  assert.deepEqual(p.calls[0], ['launch', 4]);
  assert.equal(p.machine.sel, 4);
  assert.equal(p.machine.page, 'menu');
});

test('a two-character prefix is not enough', () => {
  const ctx = ctxFor();
  exec('SE', ctx);
  assert.equal(ctx.machine.status, '?SYNTAX  ERROR');
});

test('shortcuts open a link', () => {
  const ctx = ctxFor();
  exec('DHH', ctx);
  assert.deepEqual(ctx.calls[0], ['openLink', 'https://dhh.dk/', 'DHH']);
  const mail = ctxFor();
  exec('mail', mail);
  assert.deepEqual(mail.calls[0], ['openLink', 'mailto:david@omarchy.org', 'MAIL']);
});

test('the joke commands say their piece', () => {
  const cases = [
    ['SUDO', '?PERMISSION DENIED  ERROR'],
    ['ROOT', '?PERMISSION DENIED  ERROR'],
    ['VIM', '?CANNOT EXIT  ERROR. TRY THE POWER SWITCH.'],
    [':Q!', '?CANNOT EXIT  ERROR. TRY THE POWER SWITCH.'],
    ['SYSTEMD', '?NOT FOUND  ERROR'],
  ];
  for (const [cmd, msg] of cases) {
    const ctx = ctxFor();
    exec(cmd, ctx);
    assert.equal(ctx.machine.status, msg, cmd);
    assert.equal(ctx.machine.statusCol, LTRED);
  }
});

test('SUDO buzzes, VIM does not', () => {
  const sudo = ctxFor();
  exec('SUDO', sudo);
  assert.deepEqual(sudo.calls, [['beep', 170, 0.18, 'square', 0.11, -60]]);
  const vim = ctxFor();
  exec('VIM', vim);
  assert.deepEqual(vim.calls, []);
});

test('an empty line goes back to the menu without an error', () => {
  const ctx = ctxFor();
  ctx.machine.page = 'doc';
  ctx.machine.status = 'SOMETHING';
  exec('   ', ctx);
  assert.equal(ctx.machine.page, 'menu');
  assert.equal(ctx.machine.status, '');
});

test('anything else is a syntax error', () => {
  const ctx = ctxFor();
  exec('BANANA', ctx);
  assert.equal(ctx.machine.status, '?SYNTAX  ERROR');
  assert.deepEqual(ctx.calls, [['beep', 180, 0.15, 'square', 0.1, -60]]);
});

test('a static page drops the menu hit boxes so old rows are not clickable', () => {
  for (const cmd of ['HELP', 'ABOUT', 'LIST', 'DIR']) {
    const ctx = ctxFor();
    ctx.machine.hits = [{ r: 14, x0: 2, x1: 18, menu: 0 }];
    exec(cmd, ctx);
    assert.deepEqual(ctx.machine.hits, [], `${cmd} left the menu hit boxes behind`);
  }
});
