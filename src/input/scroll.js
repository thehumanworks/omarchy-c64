/**
 * Scrolling a document on the tube: the mouse wheel, and dragging it with a
 * finger. Owns the touch drag state machine so `pointer.js` only has to ask
 * `consumesTap()` before acting on a tap.
 * Imports nothing; main.js hands it the picker and the machine.
 */

/** pixels of finger travel before a touch counts as a drag, not a tap */
const DEAD_ZONE = 10;
/** wheel pixels per text row */
const WHEEL_ROWS = 24;
/** shortest gap between two scroll beeps, in ms */
const BEEP_MS = 120;

const onDoc = (s) => s.machine.powered && s.machine.page === 'doc' && !!s.machine.doc;

function beep(s) {
  const now = Date.now();
  if (now - s.lastBeep < BEEP_MS) return;
  s.lastBeep = now;
  s.snd.beep(1900, 0.014, 'square', 0.03);
}

/** Move the document by `rows`; `renderDoc` does the clamping. */
function scrollBy(s, rows) {
  if (!rows || !onDoc(s)) return;
  s.machine.doc.off += rows;
  beep(s);
}

function onWheel(s, e) {
  if (!onDoc(s)) return;
  e.preventDefault();
  s.acc += e.deltaY / WHEEL_ROWS;
  const rows = Math.trunc(s.acc);
  s.acc -= rows;
  scrollBy(s, rows);
}

/**
 * The row under a point, when the point is on the tube. Falls back to a
 * pixel estimate so a finger that slides off the glass still scrolls.
 */
function rowAt(s, e) {
  const cell = s.cellAt(e.clientX, e.clientY);
  if (cell) return cell.row;
  const h = s.canvas.clientHeight || window.innerHeight;
  return Math.round((e.clientY / h) * s.buffer.rows);
}

function onMove(s, e) {
  if (!s.touch) return;
  const row = rowAt(s, e);
  if (!s.dragging) {
    if (Math.abs(e.clientY - s.touch.y) < DEAD_ZONE) return;
    s.dragging = true;
    s.consumed = true;
    s.row = row;
    return;
  }
  scrollBy(s, s.row - row);
  s.row = row;
}

function onEnd(s) {
  s.touch = null;
  s.dragging = false;
}

/**
 * `deps` is `{ canvas, cellAt, buffer, machine, snd }`.
 * Returns `{ start, consumesTap }` for `pointer.js` to drive.
 */
export function createScroll(deps) {
  const s = { ...deps, touch: null, dragging: false, consumed: false, row: 0, acc: 0, lastBeep: 0 };

  deps.canvas.addEventListener('wheel', (e) => onWheel(s, e), { passive: false });
  deps.canvas.addEventListener('pointermove', (e) => onMove(s, e));
  window.addEventListener('pointerup', () => onEnd(s));
  window.addEventListener('pointercancel', () => onEnd(s));

  return {
    /** A finger went down on the tube: arm the drag. */
    start(e) {
      s.touch = { y: e.clientY };
      s.dragging = false;
      s.consumed = false;
      s.row = rowAt(s, e);
    },
    /** True when the gesture that just ended was a drag, so it ate the tap. */
    consumesTap: () => s.consumed,
  };
}
