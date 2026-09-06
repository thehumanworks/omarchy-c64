/**
 * The picture tube: the phosphor-persistence ping-pong, the CRT shader that
 * turns the painter's canvas into a curved, scanned, glowing image, and the
 * black surround behind the glass. Owns the `crt` register block (on, target,
 * bright, contrast and the shader uniforms).
 * Imports three.js, `shaders/` and `textures.js`.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { canvasTexture } from './textures.js';
import { VERTEX } from './shaders/vertex.js';
import { PERSIST_FRAGMENT } from './shaders/persist-fragment.js';
import { CRT_FRAGMENT } from './shaders/crt-fragment.js';
import { TUBE_FRAGMENT } from './shaders/tube-fragment.js';

/** the aperture is the whole tube face: the picture fills the glass */
export const SCR3 = {
  x: 0.0005,
  y: 0.0305,
  w: 0.977,
  h: 0.707,
  u0: 0.08,
  u1: 0.9208,
  v0: 0.116,
  v1: 0.823,
};

export const OVER = 1.03;

const RT_OPT = {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  type: THREE.HalfFloatType,
  depthBuffer: false,
};

/** A plane with a gentle spherical bulge, like real glass. */
export function makeScreenGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 64, 44);
  const p = g.attributes.position;
  const bulge = 0.05 * Math.min(w, h);
  for (let i = 0; i < p.count; i++) {
    const u = Math.min(1, Math.abs(p.getX(i) / (w * 0.5)));
    const v = Math.min(1, Math.abs(p.getY(i) / (h * 0.5)));
    p.setZ(i, bulge * Math.cos(u * 1.15) * Math.cos(v * 1.15));
  }
  p.needsUpdate = true;
  return g;
}

export function createCrt(painter) {
  const screenTex = canvasTexture(painter.canvas);
  const persist = [
    new THREE.WebGLRenderTarget(painter.width, painter.height, RT_OPT),
    new THREE.WebGLRenderTarget(painter.width, painter.height, RT_OPT),
  ];

  const matPersist = new THREE.ShaderMaterial({
    uniforms: { uNew: { value: screenTex }, uPrev: { value: null }, uDecay: { value: 0.48 } },
    vertexShader: VERTEX,
    fragmentShader: PERSIST_FRAGMENT,
  });

  const crt = {
    on: 0,
    target: 1,
    bright: 1,
    contrast: 1,
    uniforms: {
      uTex: { value: persist[0].texture },
      uRes: { value: new THREE.Vector2(painter.width, painter.height) },
      uTime: { value: 0 },
      uOn: { value: 0 },
      uBright: { value: 1 },
      uContrast: { value: 1 },
      uDpr: { value: 1 },
      uFlash: { value: 0 },
      uGlow: { value: 0.19 },
      uFit: { value: new THREE.Vector2(1, 1) },
    },
  };

  const matScreen = new THREE.ShaderMaterial({
    uniforms: crt.uniforms,
    vertexShader: VERTEX,
    fragmentShader: CRT_FRAGMENT,
  });

  const matTube = new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: new THREE.Color(0.3, 0.3, 0.7) }, uAmount: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: TUBE_FRAGMENT,
  });

  const screenMesh = new THREE.Mesh(makeScreenGeo(SCR3.w * OVER, SCR3.h * OVER), matScreen);
  screenMesh.position.set(SCR3.x, SCR3.y + 0.02, -0.042);
  screenMesh.renderOrder = 1;

  const tubeBack = new THREE.Mesh(new THREE.PlaneGeometry(SCR3.w * 1.04, SCR3.h * 1.06), matTube);
  tubeBack.position.set(SCR3.x, SCR3.y + 0.02, -0.078);
  tubeBack.renderOrder = 0;

  /** Match the persistence buffers to a new grid size. */
  function setResolution(w, h) {
    persist[0].setSize(w, h);
    persist[1].setSize(w, h);
    crt.uniforms.uRes.value.set(w, h);
  }

  /** One persistence step; call once per frame before the scene is drawn. */
  function accumulate(blit) {
    screenTex.needsUpdate = true;
    matPersist.uniforms.uPrev.value = persist[1].texture;
    blit(matPersist, persist[0]);
    crt.uniforms.uTex.value = persist[0].texture;
    persist.reverse();
  }

  /** Re-shape the glass and its surround for a new aperture. */
  function fitAperture(ap) {
    screenMesh.geometry.dispose();
    screenMesh.geometry = makeScreenGeo(ap.w * OVER, ap.h * OVER);
    screenMesh.position.set(ap.x, ap.y, -0.042 - 0.03 * (ap.h - 0.707));
    tubeBack.geometry.dispose();
    tubeBack.geometry = new THREE.PlaneGeometry(ap.w * 1.03, ap.h * 1.04);
    tubeBack.position.set(ap.x, ap.y, -0.078 - 0.03 * (ap.h - 0.707));
  }

  /** Push the painter's canvas to the GPU right now, outside the loop. */
  function touch() {
    screenTex.needsUpdate = true;
  }

  return { crt, matTube, screenMesh, tubeBack, setResolution, accumulate, fitAperture, touch };
}
