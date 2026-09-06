/**
 * The UI state of the machine: what mode it is in, which page is on the tube,
 * what has been typed, and where the clickable text is. A plain object with
 * one instance, created by `main.js`. Owns nothing else — the grid size lives
 * on the `TextBuffer`, the CRT knobs live in `src/scene/crt.js`.
 * May import `src/text/` only.
 */

import { LTBLUE, LTGREEN } from '../text/palette.js';

export function createMachine() {
  return {
    /** 'boot' while the loader runs, 'app' once the menu is up */
    mode: 'boot',
    /** 'menu' | 'doc' | 'help' | 'about' | 'list' | 'dir' | 'maze' */
    page: 'menu',
    sel: 0,
    input: '',
    status: '',
    statusCol: LTBLUE,
    statusT: 0,
    tick: 0,
    tickerOff: 0,
    powered: true,
    maze: null,
    /** clickable text boxes written by the page renderers */
    hits: [],
    hover: null,
    doc: null,
    /** the wordmark canvas the menu overlays; `{ width, height }` is enough */
    logo: { width: 0, height: 0 },
  };
}

/** Flash a line above the READY prompt for a few seconds. */
export function say(machine, msg, col = LTGREEN) {
  machine.status = msg;
  machine.statusCol = col;
  machine.statusT = 7;
}
