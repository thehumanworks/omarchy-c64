/**
 * Builds the HELP page: two columns while the descriptions still fit beside
 * the commands, stacked once the tube gets narrow. Either way nothing runs
 * under the right rail. Pure. May import `src/text/` only.
 */

import { wrap } from '../text/wrap.js';
import { CYAN, LTGREY, YELLOW } from '../text/palette.js';

export function helpLines(w, content) {
  const s = content.strings.help;
  const rows = s.commands;
  const cw = Math.max(...rows.filter(Boolean).map((c) => c[0].length));
  const wide = cw + 2 + 16 <= w;
  const out = [[s.heading, YELLOW], ''];
  for (const row of rows) {
    if (!row) out.push('');
    else if (wide) pushWide(out, row, cw, w);
    else pushStacked(out, row, w);
  }
  out.push('', [s.footer, LTGREY]);
  return out;
}

function pushWide(out, row, cw, w) {
  wrap(row[1], w - cw - 2).forEach((s, i) => {
    const head = i ? ' '.repeat(cw + 2) : row[0].padEnd(cw + 2);
    out.push([head + s, LTGREY, i ? 0 : row[0].length]);
  });
}

function pushStacked(out, row, w) {
  out.push([row[0], CYAN]);
  wrap(row[1], w - 2).forEach((s) => out.push([`  ${s}`, LTGREY]));
}
