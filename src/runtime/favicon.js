/**
 * Paints the wordmark's O onto the favicon so the browser tab matches the
 * tube. Best effort: a failure here must never break the page.
 * Imports `src/screen/logo.js` and `src/text/palette.js`.
 */

import { CSS, BLUE } from '../text/palette.js';
import { makeLogo } from '../screen/logo.js';

export function installFavicon() {
  try {
    const fc = document.createElement('canvas');
    fc.width = 64;
    fc.height = 64;
    const fx = fc.getContext('2d');
    fx.fillStyle = CSS[BLUE];
    fx.fillRect(0, 0, 64, 64);
    fx.imageSmoothingEnabled = false;
    fx.drawImage(makeLogo(4), 0, 8, 37, 64, 13, 2, 37, 60); /* the wordmark's O */
    const link = document.querySelector('link[rel="icon"]');
    if (link) link.href = fc.toDataURL('image/png');
  } catch (err) {
    /* a tab icon is not worth a broken page */
  }
}
