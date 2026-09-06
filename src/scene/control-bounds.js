/** Project the photographed controls through the same nine-slice as the case. */
import * as THREE from '../../vendor/three.module.min.js';
import { bandAt, mapY } from './case.js';

export function controlBounds({ camera, rig, canvas, view }) {
  const cs = view.caseState;
  if (!cs || camera.position.z < 0.1) return null;
  const frame = canvas.getBoundingClientRect();
  function point(x, y) {
    const v = new THREE.Vector3(-cs.w / 2 + bandAt(cs.strip, x), mapY(cs, y), 0.01);
    v.applyMatrix4(rig.matrixWorld).project(camera);
    return {
      x: frame.left + ((v.x + 1) * frame.width) / 2,
      y: frame.top + ((1 - v.y) * frame.height) / 2,
    };
  }
  function box(x, y, width, height) {
    const a = point(x - width / 2, y - height / 2);
    const b = point(x + width / 2, y + height / 2);
    const w = Math.max(44, b.x - a.x);
    const h = Math.max(44, b.y - a.y);
    return { left: (a.x + b.x - w) / 2, top: (a.y + b.y - h) / 2, width: w, height: h };
  }
  return { nav: box(738, 905, 112, 112), enter: box(891, 914, 95, 58) };
}
