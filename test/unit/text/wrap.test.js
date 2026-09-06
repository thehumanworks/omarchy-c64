import test from 'node:test';
import assert from 'node:assert/strict';
import { wrap, sentences, pretty } from '../../../src/text/wrap.js';

test('wrap: greedy fill', () => {
  assert.deepEqual(wrap('THE MALLEABLE OS FOR THE AGE', 12), [
    'THE',
    'MALLEABLE OS',
    'FOR THE AGE',
  ]);
});

test('wrap: fits words up to the width', () => {
  assert.deepEqual(wrap('ABC DEF GHI', 7), ['ABC DEF', 'GHI']);
  assert.deepEqual(wrap('ABC DEF GHI', 11), ['ABC DEF GHI']);
  assert.deepEqual(wrap('ABC DEF GHI', 10), ['ABC DEF', 'GHI']);
});

test('wrap: splits a word longer than the line', () => {
  assert.deepEqual(wrap('ABCDEFGHIJ', 4), ['ABCD', 'EFGH', 'IJ']);
  assert.deepEqual(wrap('HI ABCDEFGHIJ OK', 4), ['HI', 'ABCD', 'EFGH', 'IJ', 'OK']);
});

test('wrap: never returns an empty list', () => {
  assert.deepEqual(wrap('', 10), ['']);
});

test('sentences: one block per sentence', () => {
  assert.deepEqual(sentences('THIS IS A LONG ENOUGH FIRST SENTENCE. AND A SECOND ONE HERE.'), [
    'THIS IS A LONG ENOUGH FIRST SENTENCE.',
    'AND A SECOND ONE HERE.',
  ]);
});

test('sentences: short sentences ride along with the previous one', () => {
  assert.deepEqual(sentences('YES. NO. MAYBE.'), ['YES. NO. MAYBE.']);
  assert.deepEqual(sentences('ONE! TWO? THREE.'), ['ONE! TWO? THREE.']);
});

test('sentences: a sentence that would push past 30 chars starts a block', () => {
  const out = sentences('SHORT. A SENTENCE THAT IS DEFINITELY LONGER THAN THIRTY CHARS.');
  assert.deepEqual(out, ['SHORT.', 'A SENTENCE THAT IS DEFINITELY LONGER THAN THIRTY CHARS.']);
});

test('pretty: strips scheme, query and trailing slashes, and upper-cases', () => {
  assert.equal(pretty('https://omarchy.org/manual/'), 'OMARCHY.ORG/MANUAL');
  assert.equal(pretty('http://omarchy.org/a//'), 'OMARCHY.ORG/A');
  assert.equal(pretty('mailto:david@omarchy.org?subject=hi'), 'DAVID@OMARCHY.ORG');
});
