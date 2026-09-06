import test from 'node:test';
import assert from 'node:assert/strict';
import { scode, codes, G, HLINE, BLOCK } from '../../../src/text/petscii.js';

test('letters map to screen codes 1..26, either case', () => {
  assert.equal(scode('A'), 1);
  assert.equal(scode('Z'), 26);
  assert.equal(scode('a'), 1);
  assert.equal(scode('z'), 26);
});

test('digits and punctuation keep their ASCII value', () => {
  assert.equal(scode('0'), 48);
  assert.equal(scode('9'), 57);
  assert.equal(scode(' '), 32);
  assert.equal(scode('!'), 33);
  assert.equal(scode('?'), 63);
});

test('the odd ones out', () => {
  assert.equal(scode('@'), 0);
  assert.equal(scode('['), 27);
  assert.equal(scode(']'), 29);
  assert.equal(scode('^'), 30);
  assert.equal(scode('£'), 28);
  assert.equal(scode('·'), 122);
  assert.equal(scode('_'), 100);
});

test('private use area is a raw screen code', () => {
  assert.equal(scode(G(0)), 0);
  assert.equal(scode(G(160)), 160);
  assert.equal(scode(HLINE), 64);
  assert.equal(scode(BLOCK), 160);
});

test('anything unknown becomes a space', () => {
  assert.equal(scode('é'), 32);
  assert.equal(scode('—'), 32);
  assert.equal(scode('{'), 32);
  assert.equal(scode('~'), 32);
});

test('codes walks a string by code point', () => {
  assert.deepEqual(codes('AB 1'), [1, 2, 32, 49]);
  assert.deepEqual(codes(`${HLINE}A`), [64, 1]);
});
