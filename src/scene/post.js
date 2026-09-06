/**
 * Post-processing: render the scene off-screen, extract the bright parts, blur
 * them at two scales, then the final lens pass to the canvas.
 * Imports three.js and `shaders/`.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { VERTEX } from './shaders/vertex.js';
import { BRIGHT_FRAGMENT } from './shaders/bright-fragment.js';
import { BLUR_FRAGMENT } from './shaders/blur-fragment.js';
import { COPY_FRAGMENT } from './shaders/copy-fragment.js';
import { FINAL_FRAGMENT } from './shaders/final-fragment.js';

const BASE = {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  type: THREE.HalfFloatType,
};

export function createPost(renderer, blit) {
  const matBright = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null }, uThresh: { value: 0.7 } },
    vertexShader: VERTEX,
    fragmentShader: BRIGHT_FRAGMENT,
  });
  const matBlur = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null },
      uDir: { value: new THREE.Vector2(1, 0) },
      uTexel: { value: new THREE.Vector2() },
    },
    vertexShader: VERTEX,
    fragmentShader: BLUR_FRAGMENT,
  });
  const matCopy = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null } },
    vertexShader: VERTEX,
    fragmentShader: COPY_FRAGMENT,
  });
  const matFinal = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null },
      uB1: { value: null },
      uB2: { value: null },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() },
      uFade: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FINAL_FRAGMENT,
  });

  const rt = { scene: null, a1: null, a2: null, b1: null, b2: null };

  function sizeTargets(w, h) {
    for (const key of Object.keys(rt)) if (rt[key]) rt[key].dispose();
    rt.scene = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, ...BASE });
    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);
    const qw = Math.max(2, w >> 3);
    const qh = Math.max(2, h >> 3);
    const o2 = { depthBuffer: false, ...BASE };
    rt.a1 = new THREE.WebGLRenderTarget(hw, hh, o2);
    rt.a2 = new THREE.WebGLRenderTarget(hw, hh, o2);
    rt.b1 = new THREE.WebGLRenderTarget(qw, qh, o2);
    rt.b2 = new THREE.WebGLRenderTarget(qw, qh, o2);
    matFinal.uniforms.uRes.value.set(w, h);
  }

  /** Blur `from` into `into` via `tmp`, one horizontal then one vertical pass. */
  function blur(from, tmp, into) {
    matBlur.uniforms.uTex.value = from.texture;
    matBlur.uniforms.uTexel.value.set(1 / from.width, 1 / from.height);
    matBlur.uniforms.uDir.value.set(1, 0);
    blit(matBlur, tmp);
    matBlur.uniforms.uTex.value = tmp.texture;
    matBlur.uniforms.uDir.value.set(0, 1);
    blit(matBlur, into);
  }

  function render(scene, camera, t) {
    renderer.setRenderTarget(rt.scene);
    renderer.clear();
    renderer.render(scene, camera);

    matBright.uniforms.uTex.value = rt.scene.texture;
    blit(matBright, rt.a1);
    blur(rt.a1, rt.a2, rt.a1);

    matCopy.uniforms.uTex.value = rt.a1.texture;
    blit(matCopy, rt.b1);
    blur(rt.b1, rt.b2, rt.b1);

    matFinal.uniforms.uTex.value = rt.scene.texture;
    matFinal.uniforms.uB1.value = rt.a1.texture;
    matFinal.uniforms.uB2.value = rt.b1.texture;
    matFinal.uniforms.uTime.value = t;
    blit(matFinal, null);
  }

  const setFade = (v) => {
    matFinal.uniforms.uFade.value = v;
  };

  return { sizeTargets, render, setFade };
}
