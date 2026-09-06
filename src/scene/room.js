/**
 * What is left of the study: one plaster wall, far behind the monitor, lit by
 * the tube. Cheap, untextured, and the only survivor of the old desk scene.
 * Imports three.js and `shaders/`.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD_VERTEX } from './shaders/world-vertex.js';
import { WALL_FRAGMENT } from './shaders/wall-fragment.js';

const WALL_Z = -2.2;

export function createWall() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uGlow: { value: new THREE.Color(0.2, 0.2, 0.6) },
      uAmount: { value: 0 },
      uTime: { value: 0 },
    },
    depthWrite: true,
    vertexShader: WORLD_VERTEX,
    fragmentShader: WALL_FRAGMENT,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), material);
  wall.position.set(0, 3.2, WALL_Z);
  wall.renderOrder = -4;
  return wall;
}
