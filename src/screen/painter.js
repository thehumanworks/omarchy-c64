/**
 * Draws a `TextBuffer` onto a 2D canvas with a character-ROM atlas, one
 * pre-tinted sheet per palette entry. Its canvas is what the CRT shader
 * samples. Owns the pixel side of the screen; the grid size comes from the
 * buffer. May import `src/text/` and `src/screen/text-buffer.js` only.
 */

import { PAL, CSS } from '../text/palette.js';
import { TextBuffer } from './text-buffer.js';

const BX = TextBuffer.BX;
const BY = TextBuffer.BY;

export class Painter {
  /** @param {TextBuffer} buffer @param {Uint8Array} rom 2 KB character ROM */
  constructor(buffer, rom) {
    this.buffer = buffer;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.atlas = buildAtlas(rom);
    this.sync();
  }

  get width() {
    return this.buffer.width;
  }

  get height() {
    return this.buffer.height;
  }

  /** Match the canvas to the buffer's current grid. */
  sync() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(t, cursorOn) {
    const b = this.buffer;
    const x = this.ctx;
    const w = this.width;
    const h = this.height;
    x.fillStyle = CSS[b.border];
    x.fillRect(0, 0, w, h);
    if (b.rasterBands) {
      for (let y = 0; y < h; y += 2) {
        x.fillStyle = CSS[b.rasterBands(y, t)];
        x.fillRect(0, y, w, 2);
      }
    }
    x.fillStyle = CSS[b.bg];
    x.fillRect(BX, BY, b.cols * 8, b.rows * 8);
    this.drawCells();
    if (b.overlay) b.overlay(x, t);
    if (cursorOn && b.cursor) this.drawCursor();
  }

  drawCells() {
    const b = this.buffer;
    const x = this.ctx;
    for (let r = 0; r < b.rows; r++) {
      const rb = BY + r * 8;
      for (let c = 0; c < b.cols; c++) {
        const i = r * b.cols + c;
        const code = b.chars[i];
        if (code === 32) continue;
        const sheet = this.atlas[b.colors[i]];
        x.drawImage(sheet, (code & 15) * 8, (code >> 4) * 8, 8, 8, BX + c * 8, rb, 8, 8);
      }
    }
  }

  drawCursor() {
    const b = this.buffer;
    const { c, r, col } = b.cursor;
    const code = (b.chars[r * b.cols + c] + 128) & 255;
    const sheet = this.atlas[col === undefined ? b.pen : col];
    const x = this.ctx;
    x.drawImage(sheet, (code & 15) * 8, (code >> 4) * 8, 8, 8, BX + c * 8, BY + r * 8, 8, 8);
  }
}

/** One 128x128 sheet of 256 glyphs per palette colour. */
function buildAtlas(rom) {
  const mask = document.createElement('canvas');
  mask.width = 128;
  mask.height = 128;
  const mc = mask.getContext('2d');
  const id = mc.createImageData(128, 128);
  for (let c = 0; c < 256; c++) {
    const gx = (c & 15) * 8;
    const gy = (c >> 4) * 8;
    for (let r = 0; r < 8; r++) {
      const b = rom[c * 8 + r];
      for (let x = 0; x < 8; x++) {
        const i = ((gy + r) * 128 + gx + x) * 4;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 255;
        id.data[i + 3] = (b >> (7 - x)) & 1 ? 255 : 0;
      }
    }
  }
  mc.putImageData(id, 0, 0);
  return PAL.map((_, i) => {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const cc = cv.getContext('2d');
    cc.drawImage(mask, 0, 0);
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = CSS[i];
    cc.fillRect(0, 0, 128, 128);
    return cv;
  });
}
