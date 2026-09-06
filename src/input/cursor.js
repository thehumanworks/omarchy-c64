/**
 * The retro pointer: a 1-bit arrow sprite drawn over the monitor in place of
 * the OS cursor, and a short-lived echo of where a finger touched the tube.
 * Owns the `#cursor` element and, while the sprite is up, `canvas.style.cursor`.
 * Reads `canvas.dataset.pointer` (set by `input/pointer.js`) to pick its shape.
 * Imports nothing.
 *
 * The shapes are pixel art: edit the strings below to redraw them.
 * `X` is the white fill, `o` the outline, `.` is transparent.
 */

const ARROW = [
  'o..........',
  'oo.........',
  'oXo........',
  'oXXo.......',
  'oXXXo......',
  'oXXXXo.....',
  'oXXXXXo....',
  'oXXXXXXo...',
  'oXXXXXXXo..',
  'oXXXXXXXXo.',
  'oXXXXXoooo.',
  'oXXoXXo....',
  'oXo.oXXo...',
  'oo..oXXo...',
  'o....oXXo..',
  '......oXXo.',
  '.......oo..',
];

const HAND = [
  '...ooo.....',
  '..oXXXo....',
  '..oXXXo....',
  '..oXXXo....',
  '..oXXXo....',
  '..oXXXoooo.',
  '..oXXXXXXXo',
  '..oXXXoXoXo',
  '.ooXXXXXXXo',
  'oXooXXXXXXo',
  'oXXoXXXXXXo',
  'oXXXXXXXXXo',
  '.oXXXXXXXXo',
  '..oXXXXXXo.',
  '..oXXXXXXo.',
  '...oXXXXo..',
  '....oooo...',
];

const FILL = '#ffffff'; /* C64 white */
const LINE = '#2e2c9b'; /* C64 blue */
const TOUCH_MS = 700;

/** One `<rect>` per run of identical cells, so the SVG stays small. */
function rects(rows) {
  const out = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let n = 1;
      while (row[x + n] === row[x]) n += 1;
      const fill = row[x] === 'X' ? FILL : LINE;
      const r = `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${fill}"/>`;
      if (row[x] !== '.') out.push(r);
      x += n;
    }
  });
  return out.join('');
}

function sprite(rows) {
  const w = rows[0].length;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows.length}" ` +
    `width="${w}" height="${rows.length}" shape-rendering="crispEdges">${rects(rows)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** `hot` is the hot-spot in source pixels: the arrow's tip, the hand's fingertip. */
const SHAPES = {
  arrow: { url: sprite(ARROW), hot: [0, 0] },
  hand: { url: sprite(HAND), hot: [3, 0] },
};

/** CSS pixels per source pixel (2, or 3 on coarse-pointer screens). */
function scale(s) {
  if (!s.k) s.k = s.el.offsetWidth / ARROW[0].length || 2;
  return s.k;
}

/** rAF-throttled: the shape is read here, so pointer.js has had its say first. */
function draw(s) {
  s.raf = 0;
  const name = s.canvas.dataset.pointer === 'link' ? 'hand' : 'arrow';
  if (name !== s.shape) {
    s.shape = name;
    s.el.style.backgroundImage = SHAPES[name].url;
    s.el.classList.toggle('hand', name === 'hand');
  }
  const k = scale(s);
  const [hx, hy] = SHAPES[name].hot;
  s.el.style.transform = `translate3d(${s.x - hx * k}px, ${s.y - hy * k}px, 0) scale(var(--cs, 1))`;
}

function queue(s) {
  if (!s.raf) s.raf = requestAnimationFrame(() => draw(s));
}

function hide(s) {
  clearTimeout(s.timer);
  s.el.classList.remove('on', 'down');
  s.canvas.style.cursor = '';
}

function onMove(s, e) {
  s.x = e.clientX;
  s.y = e.clientY;
  // Place it at once the first time, so it never appears at its last position.
  if (!s.el.classList.contains('on')) draw(s);
  queue(s);
  s.el.classList.add('on');
  clearTimeout(s.timer);
  if (e.pointerType !== 'touch') {
    s.canvas.style.cursor = 'none';
    return;
  }
  s.timer = setTimeout(() => hide(s), TOUCH_MS);
}

/** `deps` is `{ canvas, el }`. Returns `{ destroy }`. */
export function createCursor({ canvas, el }) {
  if (!el) return { destroy: () => {} };
  const s = { canvas, el, x: 0, y: 0, k: 0, raf: 0, timer: 0, shape: '' };
  const off = [];
  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    off.push(() => target.removeEventListener(type, fn));
  };
  on(canvas, 'pointerenter', (e) => onMove(s, e));
  on(canvas, 'pointermove', (e) => onMove(s, e));
  on(canvas, 'pointerdown', (e) => {
    onMove(s, e);
    el.classList.add('down');
  });
  on(window, 'pointerup', () => el.classList.remove('down'));
  on(canvas, 'pointerleave', () => hide(s));
  on(window, 'blur', () => hide(s));
  on(window, 'resize', () => {
    s.k = 0;
  });
  on(document, 'visibilitychange', () => {
    if (document.hidden) hide(s);
  });
  return {
    destroy() {
      hide(s);
      off.forEach((f) => f());
    },
  };
}
