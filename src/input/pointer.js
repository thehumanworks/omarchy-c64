/**
 * Mouse and touch: hover labels, clickable text on the tube, the three knobs
 * and the power switch. Owns the knob positions and the smoothed pointer the
 * render loop uses for its faint breath.
 * Imports `src/input/pick.js`, `src/text/` and the callbacks main.js injects.
 */

import { pretty } from '../text/wrap.js';
import { createPicker } from './pick.js';

const DRAGGABLE = ['bright', 'contrast', 'volume'];

function applyKnobs(p, which) {
  p.crt.bright = 0.42 + p.knob.bright * 1.12;
  p.crt.contrast = 0.62 + p.knob.contrast * 1.15;
  p.snd.setVol(p.knob.volume);
  if (which) p.setHint(`${which.toUpperCase()} ${Math.round(p.knob[which] * 100)}%`);
}

/** The clickable text box under the pointer, if the tube is showing any. */
function hitAt(p, cx, cy) {
  const { machine } = p;
  if (!machine.powered || machine.mode !== 'app' || !machine.hits.length) return null;
  const c = p.cellAt(cx, cy);
  if (!c) return null;
  return machine.hits.find((t) => t.r === c.row && c.col >= t.x0 && c.col <= t.x1) || null;
}

function label(p, target, hover) {
  if (!target) return hover ? p.content.strings.labels[hover] : '';
  if (target.url) return pretty(target.url);
  return p.content.strings.labels.open.replace('$1', p.content.menu[target.menu].label);
}

function trackHover(p, target) {
  const was = p.machine.hover;
  if ((target && target.r) === (was && was.r) && (target && target.x0) === (was && was.x0)) return;
  p.machine.hover = target;
  if (target && target.menu !== undefined) p.machine.sel = target.menu;
  p.repaint();
}

function onMove(p, e) {
  if (e.pointerType === 'touch') {
    const hit = p.pick(e.clientX, e.clientY);
    p.canvas.dataset.pointer =
      hitAt(p, e.clientX, e.clientY) || DRAGGABLE.includes(hit) || hit === 'power' ? 'link' : '';
    return;
  }
  p.mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  if (p.drag) {
    const d = (-(e.movementY || 0) + (e.movementX || 0)) * 0.004;
    p.knob[p.drag] = Math.min(1, Math.max(0, p.knob[p.drag] + d));
    applyKnobs(p, p.drag);
    return;
  }
  const hover = p.pick(e.clientX, e.clientY);
  const target = hover === 'screen' ? hitAt(p, e.clientX, e.clientY) : null;
  trackHover(p, target);
  const l = label(p, target, hover);
  p.canvas.dataset.pointer = target || l ? 'link' : '';
  p.setHint(l);
}

function onScreenDown(p, e) {
  const { machine } = p;
  if (!machine.powered) return;
  if (machine.mode === 'boot') return p.boot.skipBoot();
  if (machine.page === 'maze') return p.run('RUN');
  const t = hitAt(p, e.clientX, e.clientY);
  if (!t) return p.snd.beep(560, 0.05, 'triangle', 0.06, 250);
  p.snd.key();
  if (t.menu === undefined) return p.nav.follow(t.url);
  machine.sel = t.menu;
  return p.nav.launch(t.menu);
}

function startDrag(p, e, which) {
  p.drag = which;
  try {
    p.canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* no pointer capture on this browser; dragging still works */
  }
  p.snd.beep(2400, 0.014, 'square', 0.05);
}

function onDown(p, e) {
  p.wake();
  if (e.pointerType === 'touch') onMove(p, e);
  const hit = p.pick(e.clientX, e.clientY);
  if (!hit) return;
  if (e.pointerType === 'touch') return onTouchDown(p, e, hit);
  if (DRAGGABLE.includes(hit)) startDrag(p, e, hit);
  else if (hit === 'power') p.togglePower();
  else if (hit === 'screen') onScreenDown(p, e);
}

/**
 * A finger acts on release, not on contact: until it lifts we cannot know
 * whether it was a tap or a scroll. `scroll.js` owns the drag state machine.
 */
function onTouchDown(p, e, hit) {
  // Suppress compatibility mouse events: touch acts once, on release.
  e.preventDefault();
  if (hit === 'power') return p.togglePower();
  if (DRAGGABLE.includes(hit)) return startDrag(p, e, hit);
  if (hit !== 'screen') return;
  p.tap = { x: e.clientX, y: e.clientY };
  p.scroll.start(e);
}

function onTouchUp(p) {
  const tap = p.tap;
  p.tap = null;
  if (!tap || p.scroll.consumesTap()) return;
  onScreenDown(p, { clientX: tap.x, clientY: tap.y });
}

function onUp(p, e) {
  if (e.pointerType === 'touch') onTouchUp(p);
  if (!p.drag) return;
  p.drag = null;
  p.setHint('');
  try {
    p.canvas.releasePointerCapture(e.pointerId);
  } catch (err) {
    /* released already */
  }
}

function onLeave(p) {
  p.setHint('');
  if (!p.machine.hover) return;
  p.machine.hover = null;
  p.repaint();
}

/**
 * `deps` is `{ canvas, camera, monitor, screenMesh, crt, buffer, painter,
 * machine, content, snd, nav, boot, run, repaint, setHint, togglePower, wake,
 * scroll }`.
 */
export function createPointer(deps) {
  const p = {
    ...deps,
    ...createPicker(deps),
    knob: { bright: 0.62, contrast: 0.88, volume: 0.5 },
    mouse: { y: 0, ty: 0 },
    drag: null,
    tap: null,
    scroll: { start() {}, consumesTap: () => false },
  };
  const { canvas } = deps;
  canvas.addEventListener('pointermove', (e) => onMove(p, e));
  canvas.addEventListener('pointerleave', () => onLeave(p));
  canvas.addEventListener('pointerdown', (e) => onDown(p, e));
  window.addEventListener('pointerup', (e) => onUp(p, e));
  window.addEventListener('pointercancel', () => {
    p.tap = null;
    p.drag = null;
  });
  applyKnobs(p);
  /* `attach` wires the scroll state machine after it receives `cellAt`. */
  return { mouse: p.mouse, cellAt: p.cellAt, attach: (extra) => Object.assign(p, extra) };
}
