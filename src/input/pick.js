/**
 * Ray-picking against the monitor: which piece of hardware is under the
 * pointer, and which character cell of the tube.
 * Imports three.js, `src/scene/crt.js` and `src/scene/hardware.js`.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { SCR3 } from '../scene/crt.js';
import { MON } from '../scene/hardware.js';
import { TextBuffer } from '../screen/text-buffer.js';

/** knob and switch hot spots, in case-texture UV */
export const HOT = {
  bright: { u: 0.6145, v: 0.923, r: 0.035 },
  contrast: { u: 0.709, v: 0.923, r: 0.035 },
  volume: { u: 0.804, v: 0.923, r: 0.035 },
  power: { u: 0.8885, v: 0.924, r: 0.028 },
};

export function createPicker(deps) {
  const { camera, monitor, screenMesh, crt, buffer, painter } = deps;
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();

  function aim(cx, cy) {
    ptr.x = (cx / window.innerWidth) * 2 - 1;
    ptr.y = -(cy / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, camera);
  }

  function knobAt(u, v) {
    for (const k of Object.keys(HOT)) {
      const s = HOT[k];
      if (Math.hypot((u - s.u) * MON.w, (v - s.v) * MON.h) < s.r) return k;
    }
    return 'monitor';
  }

  /** 'bright' | 'contrast' | 'volume' | 'power' | 'monitor' | 'screen' | null */
  function pick(cx, cy) {
    aim(cx, cy);
    for (const h of ray.intersectObjects([monitor, screenMesh], false)) {
      if (h.object === screenMesh) return 'screen';
      const u = h.uv.x;
      const v = 1 - h.uv.y;
      const inGlass =
        u > SCR3.u0 - 0.008 && u < SCR3.u1 + 0.008 && v > SCR3.v0 - 0.008 && v < SCR3.v1 + 0.008;
      if (inGlass) continue;
      return knobAt(u, v);
    }
    return null;
  }

  /**
   * Mirror of the screen shader: barrel, then the uFit letterbox, then the
   * canvas grid. Gives the cell under the pointer so text can be clickable.
   */
  function cellAt(cx, cy) {
    aim(cx, cy);
    const h = ray.intersectObject(screenMesh, false)[0];
    if (!h) return null;
    let x = h.uv.x * 2 - 1;
    let y = h.uv.y * 2 - 1;
    const ox = Math.abs(y) / 17;
    const oy = Math.abs(x) / 14;
    x += x * ox * ox;
    y += y * oy * oy;
    const f = crt.uniforms.uFit.value;
    const col = Math.floor(((0.5 + x * 0.5 * f.x) * painter.width - TextBuffer.BX) / 8);
    const row = Math.floor(((0.5 - y * 0.5 * f.y) * painter.height - TextBuffer.BY) / 8);
    return col < 0 || col >= buffer.cols || row < 0 || row >= buffer.rows ? null : { col, row };
  }

  return { pick, cellAt };
}
