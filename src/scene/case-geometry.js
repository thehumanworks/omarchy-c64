/**
 * Turns a solved case (see `case.js`) into a three.js BufferGeometry: one quad
 * per band intersection, with the tube aperture left as a hole.
 * Owns no state. Imports three.js and `case.js`, nothing else.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { TEXH, TEXW } from './case.js';

export function buildCaseGeometry(cs) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const quad = (t, box) => {
    const n = pos.length / 3;
    pos.push(box.x0, box.y1, 0, box.x1, box.y1, 0, box.x1, box.y0, 0, box.x0, box.y0, 0);
    const u0 = t.x0 / TEXW;
    const u1 = t.x1 / TEXW;
    const v0 = 1 - t.y0 / TEXH;
    const v1 = 1 - t.y1 / TEXH;
    uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  cs.rows.forEach((r, ri) => {
    const cols = ri >= 5 ? cs.strip : cs.cols; /* the strip keeps its own split */
    const y0 = cs.h / 2 - r.a;
    const y1 = cs.h / 2 - r.b;
    if (y0 - y1 < 1e-6) return;
    for (const c of cols) {
      if (c.b - c.a < 1e-6) continue;
      if (ri === 3 && c.t0 === 150) continue; /* the hole in the middle */
      quad(
        { x0: c.t0, x1: c.t1, y0: r.t0, y1: r.t1 },
        { x0: -cs.w / 2 + c.a, x1: -cs.w / 2 + c.b, y0, y1 },
      );
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}
