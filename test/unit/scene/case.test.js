import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveBands,
  solveCase,
  bandAt,
  mapX,
  mapY,
  AP,
  COLB,
  GLASS_MIN,
  GLASS_MAX,
} from '../../../src/scene/case.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test('solveBands lays the bands end to end and fills the total', () => {
  const out = solveBands(COLB, 2.0, 0.001, 1.0);
  assert.equal(out.length, COLB.length);
  near(out[0].a, 0);
  near(out[out.length - 1].b, 2.0);
  for (let i = 1; i < out.length; i++) near(out[i].a, out[i - 1].b);
});

test('fixed bands keep their natural size and the aperture takes `mid`', () => {
  const u = 0.001;
  const out = solveBands(COLB, 2.0, u, 1.0);
  COLB.forEach((d, i) => {
    const size = out[i].b - out[i].a;
    if (d[2] === 'f') near(size, (d[1] - d[0]) * u);
    if (d[2] === 'S') near(size, 1.0);
  });
});

test('the stretchy bands share the slack in proportion', () => {
  const u = 0.001;
  const total = 3.0;
  const out = solveBands(COLB, total, u, 1.0);
  const soft = COLB.map((d, i) => [d, out[i]]).filter(([d]) => d[2] === 's');
  const sizes = soft.map(([, b]) => b.b - b.a);
  const nat = soft.map(([d]) => (d[1] - d[0]) * u);
  near(sizes[0] / sizes[1], nat[0] / nat[1]);
  near(
    sizes.reduce((a, b) => a + b, 0),
    total - 1.0 - (45 + 70 + 75 + 42) * u,
  );
});

test('bandAt interpolates inside a band and clamps past the end', () => {
  const bands = solveBands(COLB, 2.0, 0.001, 1.0);
  near(bandAt(bands, 0), 0);
  near(bandAt(bands, 1162), 2.0);
  const mid = bandAt(bands, (150 + 1010) / 2);
  near(mid, (bandAt(bands, 150) + bandAt(bands, 1010)) / 2);
});

test('a very wide viewport clamps the glass to GLASS_MAX', () => {
  const cs = solveCase(6.0, 1.03);
  assert.ok(cs.ap.w / cs.ap.h <= GLASS_MAX + 1e-9, `${cs.ap.w / cs.ap.h}`);
  near(cs.ap.w / cs.ap.h, GLASS_MAX, 1e-6);
});

test('a very tall viewport clamps the glass to GLASS_MIN', () => {
  const cs = solveCase(1.03, 6.0);
  assert.ok(cs.ap.w / cs.ap.h >= GLASS_MIN - 1e-9, `${cs.ap.w / cs.ap.h}`);
  near(cs.ap.w / cs.ap.h, GLASS_MIN, 1e-6);
});

test('a squarer viewport leaves the glass unclamped', () => {
  for (const aspect of [1.2, 1.0, 0.8]) {
    const cs = solveCase(1.03 * aspect, 1.03);
    const a = cs.ap.w / cs.ap.h;
    assert.ok(a > GLASS_MIN && a < GLASS_MAX, `aspect ${aspect} gave ${a}`);
  }
});

test('the aperture sits inside the case at every shape', () => {
  for (const [cw, ch] of [
    [1.162, 1.0],
    [1.03 * 3.2, 1.03],
    [1.03, 1.03 * 2.16],
    [1.03 * 1.6, 1.03],
  ]) {
    const cs = solveCase(cw, ch);
    assert.ok(cs.ap.w > 0 && cs.ap.h > 0);
    assert.ok(cs.ap.x - cs.ap.w / 2 >= -cw / 2 - 1e-9, 'left edge inside');
    assert.ok(cs.ap.x + cs.ap.w / 2 <= cw / 2 + 1e-9, 'right edge inside');
    assert.ok(cs.ap.y + cs.ap.h / 2 <= ch / 2 + 1e-9, 'top edge inside');
    assert.ok(cs.ap.y - cs.ap.h / 2 >= -ch / 2 - 1e-9, 'bottom edge inside');
    near(cs.ap.w, mapX(cs, AP.x1) - mapX(cs, AP.x0));
    near(cs.ap.h, mapY(cs, AP.y0) - mapY(cs, AP.y1));
  }
});

test('the case reports the size it was asked for', () => {
  const cs = solveCase(1.7, 1.03);
  near(cs.w, 1.7);
  near(cs.h, 1.03);
  near(cs.oy, 1.03 / 2 - 0.508);
  near(cs.cols[cs.cols.length - 1].b, 1.7);
  near(cs.rows[cs.rows.length - 1].b, 1.03);
});
