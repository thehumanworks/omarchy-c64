/**
 * The static pages — HELP, ABOUT, LIST, DIR — drawn once into a titled box.
 * A line is either `''`, a string, or `[text, colour, underlineWidth]` where
 * the colour may be a palette index or a name from `content/*.json`.
 * May import `src/text/` only.
 */

import { wrap } from '../text/wrap.js';
import { BL, BR, HLINE, TL, TR } from '../text/petscii.js';
import { colorIndex, CYAN, LTBLUE, WHITE } from '../text/palette.js';

const VBAR = 93;

const resolve = (col) => (typeof col === 'string' ? colorIndex(col) : col);

export function renderTextPage(buffer, lines, title) {
  const cols = buffer.cols;
  const bar = cols - 4;
  const top = 2;
  const bot = buffer.rows - 4;
  const w = cols - 6;
  buffer.overlay = null;
  buffer.clearRows(1, buffer.rows - 3);
  buffer.at(1, top, TL + HLINE.repeat(bar) + TR, LTBLUE);
  buffer.at(3, top, ` ${title.slice(0, bar - 4)} `, WHITE);
  buffer.at(1, bot, BL + HLINE.repeat(bar) + BR, LTBLUE);
  for (let q = top + 1; q < bot; q++) {
    buffer.put(1, q, VBAR, LTBLUE);
    buffer.put(cols - 2, q, VBAR, LTBLUE);
  }
  let r = top + 2;
  for (const raw of lines) {
    if (r >= bot) break;
    const l = typeof raw === 'string' ? [raw, LTBLUE, 0] : raw;
    const col = resolve(l[1]);
    /* nothing may run under the right rail: re-wrap anything wider than the tube */
    const parts = l[0].length <= w ? [l[0]] : wrap(l[0], w);
    for (let i = 0; i < parts.length && r < bot; i++, r++) {
      buffer.at(3, r, parts[i], col);
      if (l[2] && !i) buffer.at(3, r, parts[i].slice(0, l[2]), CYAN);
    }
  }
}
