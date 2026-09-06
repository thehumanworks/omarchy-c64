/**
 * The WebGL renderer, the scene graph root and the full-screen quad every
 * post-processing pass blits through. Owns nothing about the product's look.
 * Imports three.js; may be imported by `src/scene/**`, `src/input/**`,
 * `src/runtime/**` and `main.js` only.
 */

import * as THREE from '../../vendor/three.module.min.js';

export function createRenderer(canvas) {
  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const rig = new THREE.Group();
  rig.position.set(0, -0.02, 0);
  scene.add(rig);

  const fullQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  fullQuad.frustumCulled = false;
  const fsScene = new THREE.Scene();
  fsScene.add(fullQuad);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /** Draw `mat` over `target` (or the canvas when target is null). */
  function blit(mat, target) {
    fullQuad.material = mat;
    renderer.setRenderTarget(target || null);
    renderer.render(fsScene, fsCam);
  }

  return { renderer, scene, camera, rig, blit };
}
