/**
 * The C64 video RAM: a grid of screen codes plus a matching grid of colours,
 * a cursor, and the three colour registers. Pure — no canvas, no DOM — so it
 * can be rendered in a test and asserted on with `line()` / `text()`.
 *
 * Owns: `cols` and `rows`. Nothing else in the codebase stores the grid size;
 * ask the buffer. May only import from `src/text/`.
 */

import { codes } from '../text/petscii.js';
import { LTBLUE, BLUE } from '../text/palette.js';

export class TextBuffer {
  constructor(cols = 40, rows = 25) {
    this.border = LTBLUE;
    this.bg = BLUE;
    this.pen = LTBLUE;
    this.rasterBands = null;
    this.overlay = null;
    this.cursor = null;
    this.resize(cols, rows);
  }

  /** Pixel size of the picture including the border the VIC-II draws. */
  static get BX() {
    return 16;
  }

  static get BY() {
    return 21;
  }

  get width() {
    return this.cols * 8 + TextBuffer.BX * 2;
  }

  get height() {
    return this.rows * 8 + TextBuffer.BY * 2;
  }

  /** Re-shape the grid. Everything on screen is lost, as on a real mode change. */
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.chars = new Uint8Array(cols * rows).fill(32);
    this.colors = new Uint8Array(cols * rows).fill(this.pen);
    this.cx = 0;
    this.cy = 0;
  }

  clear() {
    this.chars.fill(32);
    this.colors.fill(this.pen);
    this.cx = 0;
    this.cy = 0;
  }

  clearRows(r0, r1) {
    for (let r = r0; r <= r1; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.chars[r * this.cols + c] = 32;
        this.colors[r * this.cols + c] = this.pen;
      }
    }
  }

  put(c, r, code, col) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    this.chars[r * this.cols + c] = code & 255;
    this.colors[r * this.cols + c] = (col === undefined ? this.pen : col) & 15;
  }

  /** Print `str` at (c, r). `rev` flips it into reverse video. */
  at(c, r, str, col, rev) {
    const cs = codes(str);
    for (let i = 0; i < cs.length; i++) this.put(c + i, r, rev ? (cs[i] + 128) & 255 : cs[i], col);
  }

  centre(r, str, col, rev) {
    this.at(Math.max(0, (this.cols - [...str].length) >> 1), r, str, col, rev);
  }

  scrollUp(r0, r1) {
    const w = this.cols;
    for (let r = r0; r < r1; r++) {
      for (let c = 0; c < w; c++) {
        this.chars[r * w + c] = this.chars[(r + 1) * w + c];
        this.colors[r * w + c] = this.colors[(r + 1) * w + c];
      }
    }
    for (let c = 0; c < w; c++) {
      this.chars[r1 * w + c] = 32;
      this.colors[r1 * w + c] = this.pen;
    }
  }

  nl() {
    this.cx = 0;
    this.cy++;
    if (this.cy >= this.rows) {
      this.cy = this.rows - 1;
      this.scrollUp(0, this.rows - 1);
    }
  }

  /** Type at the cursor, honouring `\n` and wrapping at the right margin. */
  type(str) {
    for (const ch of str) {
      if (ch === '\n') {
        this.nl();
        continue;
      }
      this.put(this.cx, this.cy, codes(ch)[0], this.pen);
      this.cx++;
      if (this.cx >= this.cols) this.nl();
    }
  }

  /** Row `r` read back as an ASCII string (reverse video reads as plain). */
  line(r) {
    let out = '';
    for (let c = 0; c < this.cols; c++) out += fromCode(this.chars[r * this.cols + c]);
    return out;
  }

  /** The whole screen, one string per row. */
  text() {
    const out = [];
    for (let r = 0; r < this.rows; r++) out.push(this.line(r));
    return out;
  }
}

/** Screen code → a readable character, the inverse of `scode` where it exists. */
function fromCode(raw) {
  const code = raw & 127;
  if (code === 0) return '@';
  if (code >= 1 && code <= 26) return String.fromCharCode(code + 64);
  if (code >= 32 && code <= 63) return String.fromCharCode(code);
  if (code === 27) return '[';
  if (code === 29) return ']';
  if (code === 30) return '^';
  return '·';
}
