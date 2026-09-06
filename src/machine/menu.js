/**
 * The main menu: wordmark, tagline, blurb and the 14 numbered entries in a
 * box. Writes the clickable boxes into `machine.hits`.
 * Takes `(buffer, machine, content)` and touches nothing else.
 * May import `src/text/` only.
 */

import { wrap } from '../text/wrap.js';
import { BL, BR, HLINE, TL, TR, VLINE } from '../text/petscii.js';
import { CYAN, LTBLUE, LTGREY, WHITE } from '../text/palette.js';
import { TextBuffer } from '../screen/text-buffer.js';

const VBAR = VLINE.charCodeAt(0) - 0xe000;

export function renderMenu(buffer, machine, content) {
  buffer.clearRows(1, buffer.rows - 3);
  machine.hits = [];
  buffer.overlay = makeOverlay(buffer, machine.logo);
  const r = renderHead(buffer, machine, content);
  renderList(buffer, machine, content, r);
}

function makeOverlay(buffer, logo) {
  const w = logo.width;
  const h = logo.height;
  const px = Math.round(TextBuffer.BX + (buffer.cols * 8 - w) / 2);
  const py = TextBuffer.BY + 8;
  return (x) => {
    x.imageSmoothingEnabled = false;
    x.drawImage(logo, px, py, w, h);
  };
}

/** Tagline and blurb; returns the first free row underneath. */
function renderHead(buffer, machine, content) {
  const s = content.strings.menu;
  let r = 1 + Math.ceil(machine.logo.height / 8);
  const tagline = buffer.cols >= 36 ? [s.tagline] : wrap(s.tagline, buffer.cols - 2);
  for (const t of tagline) buffer.centre(r++, t, LTGREY);
  buffer.centre(r++, s.byline, WHITE);
  r++;
  const blurb = buffer.cols >= 40 ? s.blurbWide : wrap(s.blurb, buffer.cols - 2);
  for (const t of blurb) buffer.centre(r++, t, CYAN);
  return r;
}

function renderList(buffer, machine, content, r) {
  const s = content.strings.menu;
  const cols = buffer.cols;
  const rows = buffer.rows;
  const stack = cols < 38;
  const entries = content.menu;
  const listRows = stack ? entries.length : 7;
  const top = Math.min(
    rows - 5 - listRows,
    r + Math.max(1, Math.floor((rows - 4 - r - (listRows + 2)) / 2)),
  );
  const bar = cols - 4;
  const lead = Math.floor((bar - s.caption.length) / 2);
  const cap =
    TL + HLINE.repeat(lead) + s.caption + HLINE.repeat(bar - lead - s.caption.length) + TR;
  buffer.at(1, top, cap, LTBLUE);
  const colW = Math.floor((cols - 4) / 2);
  const labW = stack ? cols - 7 : colW - 4;
  for (let i = 0; i < entries.length; i++) {
    const row = top + 1 + (stack ? i : i % 7);
    const x = stack ? 2 : 2 + (i < 7 ? 0 : colW);
    buffer.put(1, row, VBAR, LTBLUE);
    buffer.put(cols - 2, row, VBAR, LTBLUE);
    const num = String(i + 1).padStart(2, ' ');
    const label = `${num} ${entries[i].label.padEnd(labW, ' ').slice(0, labW)}`;
    if (i === machine.sel) buffer.at(x, row, label, CYAN, true);
    else {
      buffer.at(x, row, label, WHITE);
      buffer.at(x, row, num, CYAN);
    }
    machine.hits.push({ r: row, x0: x, x1: x + label.length - 1, menu: i });
  }
  buffer.at(1, top + listRows + 1, BL + HLINE.repeat(bar) + BR, LTBLUE);
  const footR = rows - 5;
  if (footR > top + listRows + 3) {
    buffer.centre(footR, cols >= 36 ? s.footerWide : s.footer, LTGREY);
  }
}
