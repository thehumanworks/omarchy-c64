/**
 * Renders `machine.doc` — a first-party page laid out by `doc-lines.js` —
 * inside a scrollable box, and registers every link row as a hit box.
 * Takes `(buffer, machine, content)`. May import `src/text/` only.
 */

import { BL, BR, HLINE, TL, TR } from '../text/petscii.js';
import { CYAN, LTBLUE, LTGREY, WHITE } from '../text/palette.js';

const VBAR = 93;
const FILLED = 160;

export function renderDoc(buffer, machine, content) {
  const d = machine.doc;
  const cols = buffer.cols;
  buffer.overlay = null;
  buffer.clearRows(1, buffer.rows - 3);
  machine.hits = [];
  const bar = cols - 4;
  const top = 1;
  const bot = buffer.rows - 4;
  const inner = bot - top - 1;
  buffer.at(1, top, TL + HLINE.repeat(bar) + TR, LTBLUE);
  buffer.at(3, top, ` ${d.title.slice(0, bar - 4)} `, WHITE);
  buffer.at(1, bot, BL + HLINE.repeat(bar) + BR, LTBLUE);
  const max = Math.max(0, d.lines.length - inner);
  d.off = Math.max(0, Math.min(max, d.off));
  renderRows(buffer, machine, { top, inner });
  if (max > 0) renderLift(buffer, d, { top, inner, max });
  const s = content.strings.doc;
  const foot = max > 0 ? s.footerScroll : s.footerBack;
  buffer.at(0, buffer.rows - 3, foot.slice(0, cols), LTGREY);
}

function renderRows(buffer, machine, box) {
  const d = machine.doc;
  const cols = buffer.cols;
  for (let i = 0; i < box.inner; i++) {
    const r = box.top + 1 + i;
    buffer.put(1, r, VBAR, LTBLUE);
    buffer.put(cols - 2, r, VBAR, LTBLUE);
    const ln = d.lines[d.off + i];
    if (!ln) continue;
    const txt = ln[0].slice(0, cols - 6);
    const on = ln[2] && machine.hover && machine.hover.r === r;
    buffer.at(3, r, txt, on ? WHITE : ln[1], !!on);
    if (ln[2]) machine.hits.push({ r, x0: 3, x1: 2 + txt.length, url: ln[2] });
  }
}

/** a little lift bar down the right rail */
function renderLift(buffer, d, box) {
  const h = Math.max(1, Math.round((box.inner * box.inner) / d.lines.length));
  const y = Math.round((box.inner - h) * (d.off / box.max));
  for (let i = 0; i < h; i++) buffer.put(buffer.cols - 2, box.top + 1 + y + i, FILLED, CYAN);
}
