/**
 * The furniture that frames every page: the title bar, the news ticker and the
 * hint + READY prompt at the foot of the screen.
 * Writes into a `TextBuffer` and reads `machine` + `content`; nothing else.
 * May import `src/text/` only.
 */

import { BLOCK } from '../text/petscii.js';
import { CYAN, GREY, LTGREY, WHITE } from '../text/palette.js';

export function drawFrame(buffer, _machine, content) {
  const { chrome } = content.strings;
  buffer.at(0, 0, BLOCK.repeat(buffer.cols), LTGREY);
  buffer.at(0, 0, chrome.title, LTGREY, true);
  const right = buffer.cols >= 38 ? chrome.versionWide : chrome.version;
  buffer.at(buffer.cols - right.length, 0, right, LTGREY, true);
}

export function drawTicker(buffer, machine, content) {
  const t = content.strings.ticker;
  let out = '';
  for (let i = 0; i < buffer.cols; i++) out += t[(machine.tickerOff + i) % t.length];
  buffer.at(0, buffer.rows - 1, out, CYAN, true);
}

export function drawPrompt(buffer, machine, content) {
  const { hints, chrome } = content.strings;
  const hintR = buffer.rows - 3;
  const readyR = buffer.rows - 2;
  const room = buffer.cols - 9;
  buffer.clearRows(hintR, readyR);
  if (machine.status) buffer.at(0, hintR, machine.status.slice(0, buffer.cols), machine.statusCol);
  else {
    const pool = hints.filter((h) => h.length <= buffer.cols);
    const list = pool.length ? pool : hints;
    const line = list[Math.floor(machine.tick / 400) % list.length];
    buffer.at(0, hintR, line.slice(0, buffer.cols), GREY);
  }
  buffer.at(0, readyR, chrome.ready, LTGREY);
  buffer.at(7, readyR, machine.input.slice(-room), WHITE);
  buffer.cursor = {
    c: Math.min(buffer.cols - 1, 7 + Math.min(room, machine.input.length)),
    r: readyR,
    col: WHITE,
  };
}
