/**
 * The disk catalogue: the menu printed as a 1541 directory listing, block
 * counts and all. Pure. May import `src/text/` only.
 */

import { LTGREY, WHITE } from '../text/palette.js';

export function dirLines(content) {
  const s = content.strings.dir;
  const out = [[s.header, WHITE], ''];
  for (const e of content.menu) {
    out.push([`${String(e.blocks).padStart(4, ' ')}  "${e.label}"`, LTGREY]);
  }
  out.push('', [s.footer, WHITE]);
  return out;
}
