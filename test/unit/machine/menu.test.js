import test from 'node:test';
import assert from 'node:assert/strict';
import { TextBuffer } from '../../../src/screen/text-buffer.js';
import { createMachine } from '../../../src/machine/state.js';
import { repaint } from '../../../src/machine/repaint.js';
import { logoSize } from '../../../src/screen/logo.js';
import * as content from '../../../src/content/index.js';

function screen(cols, rows) {
  const buffer = new TextBuffer(cols, rows);
  const machine = createMachine();
  machine.mode = 'app';
  machine.logo = logoSize(2);
  repaint(buffer, machine, content);
  return { buffer, machine, text: buffer.text() };
}

test('the title bar names the machine and the free memory', () => {
  const { text } = screen(40, 25);
  assert.ok(text[0].startsWith(' OMARCHY/64 '));
  assert.ok(text[0].endsWith(' V4.0.1 · 38911 BYTES FREE '));
  assert.equal(text[0].length, 40);
});

test('a narrow tube drops the byte count', () => {
  const { text } = screen(30, 40);
  assert.ok(text[0].startsWith(' OMARCHY/64 '));
  assert.ok(text[0].endsWith(' V4.0.1 '));
});

test('all 14 labels are on screen, two columns at 40x25', () => {
  const { text, machine } = screen(40, 25);
  const joined = text.join('\n');
  for (const e of content.menu) assert.ok(joined.includes(e.label), `${e.label} missing`);
  assert.equal(machine.hits.length, 14);
  const rows = new Set(machine.hits.map((h) => h.r));
  assert.equal(rows.size, 7, 'two columns of seven');
});

test('all 14 labels are on screen, one column at 30x40', () => {
  const { text, machine } = screen(30, 40);
  const joined = text.join('\n');
  for (const e of content.menu) assert.ok(joined.includes(e.label), `${e.label} missing`);
  assert.equal(machine.hits.length, 14);
  assert.equal(new Set(machine.hits.map((h) => h.r)).size, 14, 'one column of fourteen');
});

test('every hit box covers the text it claims', () => {
  for (const [cols, rows] of [
    [40, 25],
    [30, 40],
  ]) {
    const { text, machine } = screen(cols, rows);
    machine.hits.forEach((h, i) => {
      const entry = content.menu[i];
      const slice = text[h.r].slice(h.x0, h.x1 + 1);
      assert.equal(h.menu, i);
      assert.ok(slice.startsWith(String(i + 1).padStart(2, ' ')), `hit ${i}: "${slice}"`);
      assert.ok(slice.includes(entry.label), `hit ${i} should show ${entry.label}: "${slice}"`);
      assert.ok(h.x1 < cols - 1, 'never under the right rail');
    });
  }
});

test('the tagline, byline and blurb are centred above the menu', () => {
  const { text } = screen(40, 25);
  const joined = text.join('\n');
  assert.ok(joined.includes('BEAUTIFUL, FUN & OPINIONATED LINUX'));
  assert.ok(joined.includes('BY DHH'));
  assert.ok(joined.includes('THE MALLEABLE OS FOR THE AGE OF AGENTS.'));
  assert.ok(joined.includes('MAIN MENU'));
});

test('the ticker fills the last row and the prompt sits above it', () => {
  const { text, buffer } = screen(40, 25);
  assert.equal(text[buffer.rows - 1].length, 40);
  assert.ok(text[buffer.rows - 1].startsWith('··· OMACOM'));
  assert.ok(text[buffer.rows - 2].startsWith('READY.'));
});
