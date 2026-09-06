/**
 * The omarchy.org wordmark as block art, rasterised onto a canvas.
 * Owns the artwork and its size rule; `logoSize` is pure so the menu layout
 * can be unit-tested without a DOM. Must not import anything from `src/`.
 */

const LOGO_GRAD = [
  '#e2f8ff',
  '#9aeafc',
  '#52cdf6',
  '#2ba8f0',
  '#2f7de6',
  '#4d5cd7',
  '#7440c4',
  '#a52f9c',
];

/* the omarchy.org wordmark, verbatim: the site draws it as block art in a <pre>.
   F = full block, U = upper half, L = lower half, . = blank. 81 cells x 10 rows. */
const LOGO_ART = [
  '.................LLL.............................................................',
  '.LFFFFFL....LFFFFFFFFFFFL....LFFFFFFF...LFFFFFFF...LFFFFFFF...LF...FL....LF...FL.',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FU...FFF...FFF..FFF...FFF',
  'FFF...FFF..FFF...FFF...FFF.LFFFLLLFFF.LFFFLLLFFU..FFF.......LFFFLLLFFFL.FFFLLLFFF',
  'FFF...FFF..FFF...FFF...FFF.UFFFUUUFFF.UFFFUUUU....FFF......UUFFFUUUFFF..UUUUUUFFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF.FFFFFFFFFF..FFF...FL...FFF...FFF..LFF...FFF',
  'FFF...FFF..FFF...FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF..FFF...FFF',
  '.UFFFFFU....UF...FFF...FU...FFF...FU...FFF...FFF..FFFFFFFU...FFF...FU....UFFFFFU.',
  '.......................................FFF...FU..................................',
];

/** Pixel size of `makeLogo(px)`, without touching the DOM. */
export function logoSize(px) {
  const s = px || 2;
  return { width: LOGO_ART[0].length * s, height: LOGO_ART.length * 2 * s };
}

/** @param {number} px pixels per source half-cell */
export function makeLogo(px) {
  const s = px || 2;
  const { width: w, height: h } = logoSize(s);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#fff';
  for (let r = 0; r < LOGO_ART.length; r++) {
    const row = LOGO_ART[r];
    const y = r * 2 * s;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === 'F') c.fillRect(i * s, y, s, s * 2);
      else if (ch === 'U') c.fillRect(i * s, y, s, s);
      else if (ch === 'L') c.fillRect(i * s, y + s, s, s);
    }
  }
  c.globalCompositeOperation = 'source-atop'; /* brand gradient, as raster bars */
  const g = c.createLinearGradient(0, 0, 0, h);
  for (let i = 0; i < LOGO_GRAD.length; i++) {
    g.addColorStop(i / (LOGO_GRAD.length - 1), LOGO_GRAD[i]);
  }
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  return cv;
}
