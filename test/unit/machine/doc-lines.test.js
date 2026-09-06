import test from 'node:test';
import assert from 'node:assert/strict';
import { docLines } from '../../../src/machine/doc-lines.js';
import { HLINE } from '../../../src/text/petscii.js';
import { CYAN, GREY, LTGREEN, LTGREY, WHITE, YELLOW } from '../../../src/text/palette.js';
import { pages } from '../../../src/content/index.js';

const lines = (nodes, w = 34) => docLines({ nodes }, w);
const texts = (nodes, w) => lines(nodes, w).map((l) => l[0]);

test('H2 is underlined with a rule as wide as its widest line', () => {
  const out = lines([['H2', 'CONTENTS']]);
  assert.deepEqual(out[0], ['CONTENTS', YELLOW, undefined]);
  assert.equal(out[1][0], HLINE.repeat(8));
  assert.equal(out[1][1], CYAN);
});

test('a wrapped H2 rule matches the widest wrapped line', () => {
  const out = lines([['H2', 'ONE TWO THREE FOUR']], 10);
  assert.deepEqual(texts([['H2', 'ONE TWO THREE FOUR']], 10).slice(0, 2), [
    'ONE TWO',
    'THREE FOUR',
  ]);
  assert.equal(out[out.length - 1][0], HLINE.repeat(10));
});

test('P splits into sentence blocks with a hanging indent', () => {
  const long = 'FIRST SENTENCE IS LONG ENOUGH TO WRAP OVER TWO LINES. SECOND ONE ALSO WRAPS HERE.';
  const out = texts([['P', long]], 20);
  assert.deepEqual(out, [
    'FIRST SENTENCE IS',
    '  LONG ENOUGH TO',
    '  WRAP OVER TWO',
    '  LINES.',
    '',
    'SECOND ONE ALSO',
    '  WRAPS HERE.',
  ]);
});

test('LI gets a dash and a hanging indent', () => {
  const out = texts([['LI', 'A LIST ITEM THAT WRAPS']], 14);
  assert.deepEqual(out, ['- A LIST ITEM', '  THAT WRAPS']);
});

test('KV joins key and value with a colon', () => {
  const out = lines([['KV', 'DEVICE', '8']]);
  assert.deepEqual(out, [['DEVICE: 8', LTGREY, undefined]]);
});

test('A prints label then destination, both carrying the url', () => {
  const out = lines([['A', 'THE MANUAL', 'https://omarchy.org/manual/']]);
  assert.deepEqual(out, [
    ['THE MANUAL', LTGREEN, 'https://omarchy.org/manual/'],
    ['  OMARCHY.ORG/MANUAL', CYAN, 'https://omarchy.org/manual/'],
  ]);
});

test('A does not repeat a label that is the preceding H3', () => {
  const out = texts([
    ['H3', 'DHH'],
    ['A', 'DHH', 'https://dhh.dk/'],
  ]);
  assert.deepEqual(out, ['DHH', '  DHH.DK']);
});

test('A does not echo a destination that is already the label', () => {
  const out = lines([['A', 'DHH.DK', 'https://dhh.dk/']]);
  assert.deepEqual(out, [['DHH.DK', LTGREEN, 'https://dhh.dk/']]);
});

test('no double blanks, no leading blank, no trailing blank', () => {
  const out = texts([
    ['P', 'ONE.'],
    ['H2', 'TWO'],
    ['P', 'THREE.'],
  ]);
  assert.notEqual(out[0], '');
  assert.notEqual(out[out.length - 1], '');
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i] !== '' || out[i - 1] !== '', `double blank at row ${i}`);
  }
});

test('the real MANUAL page lays out with links and no stray blanks', () => {
  const out = docLines(pages.MANUAL, 34);
  assert.ok(out.length > 50);
  assert.equal(out[0][0], 'WELCOME TO OMARCHY!');
  assert.notEqual(out[out.length - 1][0], '');
  assert.ok(out.some((l) => l[2] && l[2].startsWith('http')));
  assert.ok(out.every((l) => l[0].length <= 34));
  assert.ok(out.some((l) => l[1] === WHITE));
  assert.ok(!out.some((l, i) => i > 0 && l[0] === '' && out[i - 1][0] === ''));
  assert.ok(out.some((l) => l[1] === GREY));
});
