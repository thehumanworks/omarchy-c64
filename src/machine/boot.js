/**
 * The power-on sequence: the BASIC banner, LOAD"OMARCHY*",8,1, the loading
 * stripes and RUN. A queue of `{ t, f }` steps stepped by the render loop.
 * `deps.crt` is the CRT's `{ on, target }` — passed in, never imported, so the
 * machine layer stays below the scene. May import `src/text/` and siblings.
 */

import { BLUE, CYAN, LTBLUE, LTGREEN, LTRED, PURPLE, WHITE, YELLOW } from '../text/palette.js';

const STRIPES = [LTBLUE, CYAN, WHITE, PURPLE, BLUE, LTGREEN, YELLOW, LTRED];

const rasterBands = (y, t) => {
  const v =
    Math.sin(y * 0.29 + t * 8.7) +
    Math.sin(y * 0.09 - t * 5.1) * 1.4 +
    Math.sin(y * 0.71 + t * 2.3);
  return STRIPES[Math.abs(Math.floor(v * 3 + y * 0.6)) % STRIPES.length];
};

/** Park the cursor wherever the type-writer got to. */
const here = (buffer) => {
  buffer.cursor = { c: buffer.cx, r: buffer.cy };
};

function banner(b) {
  b.buffer.clear();
  b.buffer.cy = 1;
  b.buffer.type(b.text.banner);
  b.buffer.type(b.text.free);
  b.buffer.type(b.text.ready);
  b.buffer.cursor = { c: 0, r: 6 };
  b.snd.beep(720, 0.045, 'square', 0.08);
}

/** Push one keystroke-per-step run of `text` onto the queue. */
function typing(q, b, text, gap) {
  for (const ch of text) {
    q.push({
      t: 0,
      f: () => {
        b.buffer.type(ch);
        here(b.buffer);
        b.snd.key();
      },
    });
    q.push({ t: gap });
  }
}

function finish(b) {
  b.machine.mode = 'app';
  b.machine.page = 'menu';
  b.buffer.clear();
  b.repaint();
  b.snd.beep(233, 0.07, 'triangle', 0.09, 400);
  setTimeout(() => b.snd.beep(466, 0.07, 'triangle', 0.09, 350), 75);
  setTimeout(() => b.snd.beep(699, 0.18, 'triangle', 0.09, 250), 150);
}

function makeQueue(b) {
  const q = [];
  const wait = (s) => q.push({ t: s });
  const run = (f) => q.push({ t: 0, f });
  wait(0.95);
  run(() => banner(b));
  wait(0.85);
  typing(q, b, b.text.load, 0.052);
  wait(0.42);
  run(() => {
    b.buffer.nl();
    b.buffer.type(b.text.searching);
    here(b.buffer);
    b.snd.drive(true);
  });
  wait(0.7);
  run(() => {
    b.buffer.type(b.text.loading);
    b.buffer.cursor = { c: 0, r: b.buffer.cy };
  });
  wait(0.3);
  run(() => {
    b.buffer.rasterBands = rasterBands;
  });
  wait(2.25);
  run(() => {
    b.buffer.rasterBands = null;
    b.buffer.border = LTBLUE;
    b.snd.drive(false);
    b.buffer.type(b.text.ready);
    b.buffer.cursor = { c: 0, r: b.buffer.cy };
  });
  wait(0.45);
  typing(q, b, b.text.run, 0.1);
  wait(0.4);
  run(() => finish(b));
  return q;
}

/** Reset every register the way a real cold start does. */
function reset(b) {
  const { machine, buffer } = b;
  machine.mode = 'boot';
  machine.page = 'menu';
  machine.sel = 0;
  machine.input = '';
  machine.status = '';
  machine.maze = null;
  buffer.overlay = null;
  buffer.rasterBands = null;
  buffer.cursor = null;
  buffer.border = LTBLUE;
  buffer.bg = BLUE;
  buffer.pen = LTBLUE;
  buffer.clear();
}

function coldStart(b) {
  reset(b);
  b.crt.on = 0;
  b.crt.target = 1;
  b.snd.power(true);
  b.queue = makeQueue(b);
  b.acc = 0;
}

function skipBoot(b) {
  if (b.machine.mode !== 'boot') return;
  b.queue = [];
  b.snd.drive(false);
  b.buffer.rasterBands = null;
  b.buffer.border = LTBLUE;
  b.buffer.bg = BLUE;
  b.buffer.pen = LTBLUE;
  b.crt.on = 1;
  b.machine.mode = 'app';
  b.machine.page = 'menu';
  b.buffer.clear();
  b.repaint();
}

function step(b, dt) {
  if (!b.queue.length) return;
  b.acc += dt;
  let guard = 0;
  while (b.queue.length && b.acc >= b.queue[0].t && guard++ < 400) {
    b.acc -= b.queue[0].t;
    const s = b.queue.shift();
    if (s.f) s.f();
  }
}

/** `deps` is `{ buffer, machine, content, snd, repaint, crt }`. */
export function createBoot(deps) {
  const b = { ...deps, text: deps.content.strings.boot, queue: [], acc: 0 };
  return {
    coldStart: () => coldStart(b),
    skipBoot: () => skipBoot(b),
    step: (dt) => step(b, dt),
    /** Abandon the sequence, e.g. when the power goes off. */
    stop: () => {
      b.queue = [];
    },
  };
}
