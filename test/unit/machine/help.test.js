import test from 'node:test';
import assert from 'node:assert/strict';
import { helpLines } from '../../../src/machine/help.js';
import * as content from '../../../src/content/index.js';
import { CYAN, LTGREY, YELLOW } from '../../../src/text/palette.js';

const CW = 12; /* 'POKE 53280,N' is the widest command */

test('the heading and the footer bracket the table', () => {
  const out = helpLines(34, content);
  assert.deepEqual(out[0], [content.strings.help.heading, YELLOW]);
  assert.equal(out[1], '');
  assert.deepEqual(out[out.length - 1], [content.strings.help.footer, LTGREY]);
  assert.equal(out[out.length - 2], '');
});

test('wide layout puts the description beside the command', () => {
  const out = helpLines(34, content);
  const row = out.find((l) => Array.isArray(l) && l[0].startsWith('RUN'));
  assert.deepEqual(row, [`RUN${' '.repeat(CW + 2 - 3)}BACK TO THE MENU`, LTGREY, 3]);
  assert.equal(row[0].length, CW + 2 + 'BACK TO THE MENU'.length);
});

test('the blank row in the command table becomes a blank line', () => {
  const out = helpLines(34, content);
  const poke = out.findIndex((l) => Array.isArray(l) && l[0].startsWith('POKE 53280,N'));
  assert.equal(out[poke - 1], '');
});

test('narrow layout stacks the description under the command', () => {
  const out = helpLines(20, content);
  const i = out.findIndex((l) => Array.isArray(l) && l[0] === 'RUN');
  assert.deepEqual(out[i], ['RUN', CYAN]);
  assert.deepEqual(out[i + 1], ['  BACK TO THE MENU', LTGREY]);
});

test('the layout flips at cw + 2 + 16', () => {
  const wide = helpLines(CW + 2 + 16, content);
  const narrow = helpLines(CW + 2 + 15, content);
  assert.ok(wide.some((l) => Array.isArray(l) && l[0].startsWith('RUN ')));
  assert.ok(narrow.some((l) => Array.isArray(l) && l[0] === 'RUN'));
});

test('no command row ever runs wider than the tube', () => {
  for (const w of [20, 26, 34, 40]) {
    /* the heading and the footer are re-wrapped by the page renderer */
    for (const l of helpLines(w, content).slice(2, -2)) {
      if (Array.isArray(l)) assert.ok(l[0].length <= w, `"${l[0]}" is wider than ${w}`);
    }
  }
});
