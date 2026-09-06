import test from 'node:test';
import assert from 'node:assert/strict';
import { TextBuffer } from '../../../src/screen/text-buffer.js';
import { CYAN, LTBLUE, WHITE } from '../../../src/text/palette.js';

const at = (b, c, r) => b.chars[r * b.cols + c];
const ink = (b, c, r) => b.colors[r * b.cols + c];

test('a fresh buffer is 40x25 spaces in the pen colour', () => {
  const b = new TextBuffer(40, 25);
  assert.equal(b.cols, 40);
  assert.equal(b.rows, 25);
  assert.equal(b.chars.length, 1000);
  assert.equal(b.line(0), ' '.repeat(40));
  assert.equal(ink(b, 0, 0), LTBLUE);
  assert.equal(b.width, 40 * 8 + 32);
  assert.equal(b.height, 25 * 8 + 42);
});

test('put writes one cell and clamps to the grid', () => {
  const b = new TextBuffer(4, 3);
  b.put(1, 1, 5, WHITE);
  assert.equal(at(b, 1, 1), 5);
  assert.equal(ink(b, 1, 1), WHITE);
  assert.deepEqual(b.text(), ['    ', ' E  ', '    ']);
  b.put(-1, 0, 9);
  b.put(0, 9, 9);
  b.put(4, 0, 9);
  assert.deepEqual(b.text(), ['    ', ' E  ', '    ']);
  b.put(0, 0, 300, 99);
  assert.equal(at(b, 0, 0), 300 & 255);
  assert.equal(ink(b, 0, 0), 99 & 15);
});

test('at prints a string, and rev flips it into reverse video', () => {
  const b = new TextBuffer(10, 2);
  b.at(2, 0, 'HI', WHITE);
  assert.equal(at(b, 2, 0), 8);
  assert.equal(at(b, 3, 0), 9);
  b.at(0, 1, 'HI', CYAN, true);
  assert.equal(at(b, 0, 1), 8 + 128);
  assert.equal(at(b, 1, 1), 9 + 128);
  assert.equal(b.line(1), 'HI        ');
});

test('centre puts a string in the middle of the row', () => {
  const b = new TextBuffer(10, 1);
  b.centre(0, 'ABCD');
  assert.equal(b.line(0), '   ABCD   ');
  b.clear();
  b.centre(0, 'ABCDEFGHIJKL');
  assert.equal(b.line(0), 'ABCDEFGHIJ');
});

test('scrollUp moves rows up and blanks the last one', () => {
  const b = new TextBuffer(4, 4);
  b.at(0, 0, 'AAAA');
  b.at(0, 1, 'BBBB');
  b.at(0, 2, 'CCCC');
  b.scrollUp(0, 2);
  assert.deepEqual(b.text(), ['BBBB', 'CCCC', '    ', '    ']);
});

test('nl wraps to the next row and scrolls at the bottom', () => {
  const b = new TextBuffer(4, 2);
  b.at(0, 0, 'AAAA');
  b.at(0, 1, 'BBBB');
  b.cy = 1;
  b.cx = 3;
  b.nl();
  assert.equal(b.cx, 0);
  assert.equal(b.cy, 1);
  assert.deepEqual(b.text(), ['BBBB', '    ']);
});

test('type honours newlines and wraps at the right margin', () => {
  const b = new TextBuffer(4, 3);
  b.type('AB\nCDEFG');
  assert.deepEqual(b.text(), ['AB  ', 'CDEF', 'G   ']);
  assert.equal(b.cx, 1);
  assert.equal(b.cy, 2);
});

test('clearRows only wipes the range it is given', () => {
  const b = new TextBuffer(4, 4);
  for (let r = 0; r < 4; r++) b.at(0, r, 'XXXX');
  b.clearRows(1, 2);
  assert.deepEqual(b.text(), ['XXXX', '    ', '    ', 'XXXX']);
});

test('resize re-shapes the grid and resets the cursor', () => {
  const b = new TextBuffer(40, 25);
  b.type('HELLO');
  b.resize(30, 40);
  assert.equal(b.cols, 30);
  assert.equal(b.rows, 40);
  assert.equal(b.chars.length, 1200);
  assert.equal(b.cx, 0);
  assert.equal(b.cy, 0);
  assert.equal(b.line(0), ' '.repeat(30));
  assert.equal(b.width, 30 * 8 + 32);
});
