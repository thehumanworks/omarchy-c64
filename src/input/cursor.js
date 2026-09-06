/**
 * The retro pointer: a 1-bit arrow sprite drawn over the monitor in place of
 * the OS cursor, and a persistent pointer at the last finger position.
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

/** CSS pixels per source pixel; the same compact sprite on mouse and touch. */
function scale(s) {
  if (!s.k) s.k = s.el.offsetWidth / ARROW[0].length || 1.5;
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
  const vv = window.visualViewport;
  const left = vv?.offsetLeft || 0;
  const top = vv?.offsetTop || 0;
  const [hx, hy] = SHAPES[name].hot;
  const right = left + (vv?.width || window.innerWidth) - s.el.offsetWidth;
  const bottom = top + (vv?.height || window.innerHeight) - s.el.offsetHeight;
  const x = Math.max(left, Math.min(s.x - hx * k, right));
  const y = Math.max(top, Math.min(s.y - hy * k, bottom));
  s.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(var(--cs, 1))`;
}

function queue(s) {
  if (!s.raf) s.raf = requestAnimationFrame(() => draw(s));
}

function hide(s) {
  s.el.classList.remove('on', 'down');
  s.canvas.style.cursor = '';
}

/**
 * Headless Chromium (CI on Linux) synthesises a mouse event at (0,0) when the
 * page loads. No one parks a real pointer on that exact pixel, so it is
 * ignored: the sprite must not light up before a person moves the mouse.
 */
const phantom = (e) => e.pointerType !== 'touch' && e.clientX === 0 && e.clientY === 0;

function onMove(s, e) {
  if (phantom(e)) return;
  s.touch = e.pointerType === 'touch';
  s.x = e.clientX;
  s.y = e.clientY;
  // Place it at once the first time, so it never appears at its last position.
  if (!s.el.classList.contains('on')) draw(s);
  queue(s);
  s.el.classList.add('on');
  if (e.pointerType !== 'touch') {
    s.canvas.style.cursor = 'none';
    return;
  }
  s.canvas.style.cursor = '';
}

/** `deps` is `{ canvas, el }`. Returns `{ destroy }`. */
export function createCursor({ canvas, el }) {
  if (!el) return { destroy: () => {} };
  const s = { canvas, el, x: 0, y: 0, k: 0, raf: 0, touch: false, shape: '' };
  const off = [];
  const on = (target, type, fn) => {
    target.addEventListener(type, fn);
    off.push(() => target.removeEventListener(type, fn));
  };
  // No pointerenter: a real entry is always followed by a pointermove.
  on(canvas, 'pointermove', (e) => onMove(s, e));
  on(canvas, 'pointerdown', (e) => {
    onMove(s, e);
    el.classList.add('down');
  });
  const controls = document.getElementById('monitor-controls');
  if (controls) {
    for (const event of ['pointerdown', 'pointermove']) {
      on(controls, event, (e) => {
        canvas.dataset.pointer = 'link';
        onMove(s, e);
        if (event === 'pointerdown') el.classList.add('down');
      });
    }
  }
  on(window, 'pointerup', () => el.classList.remove('down'));
  on(window, 'pointercancel', () => el.classList.remove('down'));
  on(canvas, 'pointerleave', (e) => {
    if (e.pointerType !== 'touch' && !s.touch) hide(s);
  });
  on(window, 'blur', () => {
    if (!s.touch) hide(s);
  });
  on(window, 'resize', () => {
    s.k = 0;
    queue(s);
  });
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', () => queue(s));
    on(window.visualViewport, 'scroll', () => queue(s));
  }
  on(document, 'visibilitychange', () => {
    if (document.hidden && !s.touch) hide(s);
  });
  if (window.matchMedia('(pointer: coarse)').matches) {
    onMove(s, {
      pointerType: 'touch',
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
    });
  }
  return {
    destroy() {
      hide(s);
      off.forEach((f) => f());
    },
  };
}
