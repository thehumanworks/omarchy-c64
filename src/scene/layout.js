/**
 * Fits everything to the viewport: solves the case for the new aspect,
 * rebuilds the case mesh and the glass, picks a character grid that matches
 * the tube, and works out the letterbox the CRT shader needs.
 * Owns `view.z` (the resting camera distance) and the current solved case.
 * Imports three-free helpers plus its scene siblings.
 */

import { gridFor } from '../text/grid.js';
import { solveCase, mapX, mapY, bandAt } from './case.js';
import { MON, reshapeMonitor } from './hardware.js';
import { OVER } from './crt.js';

const BLEED = 1.03; /* overscan the plain outer plastic */
const STRETCH = 1.45;
const SAFE = 0.962;

/**
 * `deps` is `{ renderer, camera, rig, tube, post, monitor, ledPower,
 * painter, buffer, machine, content, repaint, relayoutDoc }`.
 */
export function createLayout(deps) {
  const { renderer, camera, rig, tube, post, painter, buffer, machine } = deps;
  const view = { z: 3.5 };
  let caseState = solveCase(MON.w, MON.h);

  /** Re-shape the character grid. Returns true when it actually changed. */
  function setGrid(cols, rows) {
    if (cols === buffer.cols && rows === buffer.rows) return false;
    buffer.resize(cols, rows);
    painter.sync();
    tube.setResolution(painter.width, painter.height);
    machine.sel = Math.min(machine.sel, deps.content.menu.length - 1);
    deps.relayoutDoc();
    return true;
  }

  /**
   * Fit the character block to the tube. A CRT was always a bit off on width
   * and height, so allow a capped non-uniform stretch before falling back to a
   * plain C64 border: on a normal screen the picture ends up edge to edge.
   */
  function fitPicture(ap) {
    const tw = ap.w * OVER;
    const th = ap.h * OVER;
    const fx = (ap.w * SAFE) / (buffer.cols * 8);
    const fy = (ap.h * SAFE) / (buffer.rows * 8);
    const sc = Math.min(fx, fy);
    const ax = Math.min(fx, sc * STRETCH);
    const ay = Math.min(fy, sc * STRETCH);
    tube.crt.uniforms.uFit.value.set(tw / (ax * painter.width), th / (ay * painter.height));
  }

  function syncCase() {
    reshapeMonitor(deps.monitor, caseState);
    const ap = caseState.ap;
    tube.fitAperture(ap);
    const g = gridFor(ap.w / ap.h);
    if (setGrid(g.cols, g.rows)) {
      deps.repaint();
      painter.render(0, true);
      tube.touch();
    }
    fitPicture(ap);
    const px = deps.navigation
      ? -caseState.w / 2 + bandAt(caseState.strip, 1024)
      : mapX(caseState, 1033);
    deps.ledPower.position.set(px, mapY(caseState, deps.navigation ? 881 : 893), 0.012);
    rig.position.set(0, caseState.oy, 0);
  }

  function layout() {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 2600000 ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    tube.crt.uniforms.uDpr.value = dpr;
    post.sizeTargets(Math.max(2, Math.floor(w * dpr)), Math.max(2, Math.floor(h * dpr)));
    const vfov = (camera.fov * Math.PI) / 180;
    caseState = solveCase(BLEED * camera.aspect, BLEED);
    view.caseState = caseState;
    view.z = 1 / (2 * Math.tan(vfov / 2));
    camera.updateProjectionMatrix();
    syncCase();
  }

  return { layout, view };
}
