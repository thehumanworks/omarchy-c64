import test from 'node:test';
import assert from 'node:assert/strict';
import { gridFor } from '../../../src/text/grid.js';

test('column count steps at the documented aspect thresholds', () => {
  assert.equal(gridFor(1.6).cols, 40);
  assert.equal(gridFor(1.25).cols, 40);
  assert.equal(gridFor(1.2499).cols, 36);
  assert.equal(gridFor(0.98).cols, 36);
  assert.equal(gridFor(0.9799).cols, 34);
  assert.equal(gridFor(0.72).cols, 34);
  assert.equal(gridFor(0.7199).cols, 30);
});

test('rows follow the aspect', () => {
  assert.deepEqual(gridFor(1.6), { cols: 40, rows: 25 });
  assert.deepEqual(gridFor(1.0), { cols: 36, rows: 36 });
  assert.deepEqual(gridFor(0.5), { cols: 30, rows: 60 });
});

test('rows clamp to 25..60', () => {
  assert.equal(gridFor(4).rows, 25);
  assert.equal(gridFor(1.25).rows, 32);
  assert.equal(gridFor(0.1).rows, 60);
  assert.equal(gridFor(0.001).rows, 60);
});
