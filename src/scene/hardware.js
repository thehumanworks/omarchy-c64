/**
 * The plastic: the nine-sliced 1702 case and the power LED that sits in it.
 * Owns the hardware and LED materials. Imports three.js, `shaders/`,
 * `case.js` and `case-geometry.js`.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { buildCaseGeometry } from './case-geometry.js';
import { VERTEX } from './shaders/vertex.js';
import { WORLD_VERTEX } from './shaders/world-vertex.js';
import { HARDWARE_FRAGMENT } from './shaders/hardware-fragment.js';
import { LED_FRAGMENT } from './shaders/led-fragment.js';

/** The case photograph's world size: 1162 x 1000 texels at 0.001 each. */
export const MON = { w: 1.162, h: 1.0 };

function hardwareMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uAmbient: { value: o.ambient !== undefined ? o.ambient : 0.26 },
      uGlow: { value: new THREE.Color(0.3, 0.3, 0.7) },
      uAmount: { value: 0 },
      uCenter: { value: new THREE.Vector3(0, 0.06, 0) },
      uFall: { value: o.fall !== undefined ? o.fall : 1.15 },
      uTop: { value: o.top !== undefined ? o.top : 0.1 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: WORLD_VERTEX,
    fragmentShader: HARDWARE_FRAGMENT,
  });
}

function ledMaterial(hex) {
  return new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uCol: { value: new THREE.Color(hex) } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: VERTEX,
    fragmentShader: LED_FRAGMENT,
  });
}

function ledMesh(mat, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.renderOrder = 8;
  return m;
}

/** The case mesh plus its power LED, ready to be added to the rig. */
export function createMonitor(caseState, texture) {
  const mat = hardwareMaterial(texture, { ambient: 0.235, fall: 0.85, top: 0.06 });
  const monitor = new THREE.Mesh(buildCaseGeometry(caseState), mat);
  monitor.position.set(0, 0, 0);
  monitor.renderOrder = 2;
  const powerMat = ledMaterial(0x6dff9a);
  const power = ledMesh(powerMat, 0.05);
  power.position.set((0.8885 - 0.5) * MON.w, (0.5 - 0.893) * MON.h + 0.02, 0.01);
  return { monitor, power, powerMat };
}

/** Rebuild the case geometry after the viewport changed shape. */
export function reshapeMonitor(monitor, caseState) {
  monitor.geometry.dispose();
  monitor.geometry = buildCaseGeometry(caseState);
}
