/**
 * The animate tick: step the machine, repaint the tube, roll the phosphor,
 * feed the room its bounce light, move the camera a hair, then post-process.
 * Owns the clock and the derived glow colour. Imports three.js and whatever
 * main.js hands it; nothing imports this back.
 */

import * as THREE from '../../vendor/three.module.min.js';
import { stepMaze } from '../machine/maze.js';

const GLOW_TINT = new THREE.Color(0.55, 0.6, 1.0);

/** A 12x8 thumbnail of the tube, averaged into the room's bounce colour. */
function createSampler(painter, avgCol) {
  const cv = document.createElement('canvas');
  cv.width = 12;
  cv.height = 8;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  return function sample() {
    ctx.drawImage(painter.canvas, 0, 0, 12, 8);
    const d = ctx.getImageData(0, 0, 12, 8).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = (d.length / 4) * 255;
    avgCol.setRGB(r / n, g / n, b / n);
  };
}

function stepMachine(L, dt) {
  const { machine } = L;
  machine.tick++;
  if (!machine.powered) return;
  L.boot.step(dt);
  if (machine.mode !== 'app') return;
  if (machine.page === 'maze') stepMaze(L.buffer, machine, dt);
  else {
    if (machine.statusT > 0) {
      machine.statusT -= dt;
      if (machine.statusT <= 0) machine.status = '';
    }
    L.repaint();
  }
  if (machine.tick % 22 === 0) {
    machine.tickerOff = (machine.tickerOff + 1) % L.content.strings.ticker.length;
  }
}

function stepCrt(L, dt, t) {
  const crt = L.tube.crt;
  const prevOn = crt.on;
  crt.on += (crt.target - crt.on) * Math.min(1, dt * (crt.target > crt.on ? 3.2 : 9));
  if (crt.target > 0.5 && prevOn < 0.22 && crt.on >= 0.22) L.flash = 1;
  L.flash *= Math.pow(0.0018, dt);
  const u = crt.uniforms;
  u.uOn.value = crt.on;
  u.uFlash.value = L.flash * 0.5;
  u.uTime.value = t;
  u.uBright.value = crt.bright;
  u.uContrast.value = crt.contrast;
  u.uGlow.value += ((L.machine.page === 'doc' ? 0.085 : 0.19) - u.uGlow.value) * 0.08;
}

function stepGlow(L, dt, t) {
  const { avgCol, glowCol } = L;
  const lit = 0.5 + 0.5 * Math.min(1, (avgCol.r + avgCol.g + avgCol.b) * 1.5);
  L.glowAmt += (L.tube.crt.on * lit - L.glowAmt) * Math.min(1, dt * 7);
  glowCol.copy(avgCol).lerp(GLOW_TINT, 0.45);
  for (const m of [L.monitor.material, L.tube.matTube, L.wall.material]) {
    m.uniforms.uAmount.value = L.glowAmt;
    m.uniforms.uGlow.value.copy(glowCol);
    if (m.uniforms.uTime) m.uniforms.uTime.value = t;
  }
  L.powerMat.uniforms.uOn.value = L.machine.powered ? 0.9 + 0.06 * Math.sin(t * 7) : 0;
}

/* no orbit: the framing is fixed. only a faint breath so it is not dead. */
function stepCamera(L, dt, t) {
  const { mouse, camera } = L;
  mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3.0);
  const intro = Math.min(1, Math.max(0, (t - 0.1) / 2.4));
  const iE = 1 - Math.pow(1 - intro, 3);
  const dy = mouse.y + Math.sin(t * 0.16 + 1.7) * 0.07;
  camera.position.set(0, -dy * 0.005, L.view.z * (1 - (1 - iE) * 0.09));
  camera.lookAt(0, 0, 0);
  L.rig.rotation.y = 0;
  L.rig.rotation.x = dy * 0.006;
  L.post.setFade(Math.min(1, 0.04 + iE * 1.15));
}

/**
 * `deps` is `{ scene, camera, rig, blit, post, tube, monitor, wall, powerMat,
 * painter, buffer, machine, content, boot, repaint, view, mouse, syncLayout }`.
 */
export function createLoop(deps) {
  const L = {
    ...deps,
    avgCol: new THREE.Color(0.25, 0.25, 0.6),
    glowCol: new THREE.Color(0.3, 0.3, 0.7),
    flash: 0,
    glowAmt: 0,
    sampleAcc: 0,
  };
  const clock = new THREE.Clock();
  const sample = createSampler(L.painter, L.avgCol);

  function frame() {
    requestAnimationFrame(frame);
    L.syncLayout();
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.getElapsedTime();
    stepMachine(L, dt);
    stepCrt(L, dt, t);
    L.painter.render(t, (t * 1.9) % 1 < 0.55);
    L.tube.accumulate(L.blit);
    L.sampleAcc += dt;
    if (L.sampleAcc > 0.05) {
      L.sampleAcc = 0;
      sample();
    }
    stepGlow(L, dt, t);
    stepCamera(L, dt, t);
    L.post.render(L.scene, L.camera, t);
    L.syncInput?.();
  }

  return { start: frame };
}
