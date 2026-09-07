import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigator } from '../../../src/machine/navigate.js';
import { createMachine } from '../../../src/machine/state.js';
import { TextBuffer } from '../../../src/screen/text-buffer.js';
import * as content from '../../../src/content/index.js';

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const machine = createMachine();
  const buffer = new TextBuffer(40, 25);
  const calls = [];
  const record =
    (name) =>
    (...args) =>
      calls.push([name, ...args]);
  const nav = createNavigator({
    machine,
    buffer,
    content,
    snd: { beep: record('beep') },
    repaint: record('repaint'),
    links: { newTab: record('tab'), mailto: record('mail') },
  });
  return { machine, buffer, nav, calls };
}

test('every menu entry routes to its bundled page or its original external URL', (t) => {
  const { machine, nav, calls } = fixture(t);
  for (const [i, entry] of content.menu.entries()) {
    calls.length = 0;
    nav.launch(i);
    if (content.pages[entry.label]) {
      assert.equal(machine.page, 'doc');
      assert.equal(machine.doc.key, entry.label);
      assert.equal(machine.doc.off, 0);
      assert.ok(machine.doc.lines.length > 0);
      assert.ok(calls.some(([name]) => name === 'repaint'));
      assert.ok(!calls.some(([name]) => name === 'tab'));
    } else assert.deepEqual(calls.at(-1), ['tab', entry.url]);
  }
});

test('following a bundled URL tolerates trailing slashes without opening a tab', (t) => {
  const { machine, nav, calls } = fixture(t);
  const page = content.pages.MANUAL;
  for (const url of [page.url.replace(/\/+$/, ''), `${page.url}/`]) {
    nav.follow(url);
    assert.equal(machine.doc.key, 'MANUAL');
  }
  assert.ok(!calls.some(([name]) => name === 'tab'));
});

test('an unbundled same-origin chapter remains an external link, with both launch tones', (t) => {
  const { nav, calls } = fixture(t);
  const url = 'https://omarchy.org/manual/a-chapter/';
  nav.follow(url);
  assert.deepEqual(calls.at(-1), ['tab', url]);
  assert.equal(calls.filter(([name]) => name === 'beep').length, 1);
  t.mock.timers.tick(85);
  assert.deepEqual(calls.at(-1), ['beep', 780, 0.11, 'square', 0.11, 380]);
});

test('following mail uses the current location; direct command links keep their tab behavior', (t) => {
  const { machine, nav, calls } = fixture(t);
  const url = 'mailto:david@omarchy.org';
  nav.follow(url);
  assert.deepEqual(calls.at(-1), ['mail', url]);
  assert.equal(machine.status, content.strings.status.mail);
  nav.openLink(url, 'MAIL');
  assert.deepEqual(calls.at(-1), ['tab', url]);
});

test('document relayout rewraps at the new width and resets scroll only for an open doc', (t) => {
  const { machine, buffer, nav } = fixture(t);
  nav.follow(content.pages.NEWS.url);
  const previous = machine.doc.lines;
  machine.doc.off = 10;
  buffer.resize(28, 35);
  nav.relayoutDoc();
  assert.notDeepEqual(machine.doc.lines, previous);
  assert.equal(machine.doc.off, 0);
  machine.page = 'menu';
  machine.doc.off = 7;
  nav.relayoutDoc();
  assert.equal(machine.doc.off, 7);
});
