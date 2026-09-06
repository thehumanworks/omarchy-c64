/**
 * Lays a scraped omarchy.org page out for a 40-column tube: headings in the
 * frame colours, paragraphs word-wrapped one sentence per block, links printed
 * the way a terminal would print them. Everything the site says, nothing it
 * doesn't. Pure — a page plus a width in, `[text, colour, url?]` rows out.
 * May import `src/text/` only.
 */

import { pretty, sentences, wrap } from '../text/wrap.js';
import { HLINE } from '../text/petscii.js';
import { CYAN, GREY, LTGREEN, LTGREY, WHITE, YELLOW } from '../text/palette.js';

/** One handler per node kind. `ctx` carries the width and the running state. */
const NODES = {
  H2(node, push, ctx) {
    if (ctx.count()) push('', GREY);
    const h = wrap(node[1], ctx.width);
    for (const l of h) push(l, YELLOW);
    push(HLINE.repeat(Math.max(...h.map((l) => l.length))), CYAN);
  },

  H3(node, push, ctx) {
    if (ctx.count()) push('', GREY);
    ctx.lastH3 = node[1];
    for (const l of wrap(node[1], ctx.width)) push(l, YELLOW);
  },

  /* one sentence per block, continuation lines hang two columns in */
  P(node, push, ctx) {
    for (const s of sentences(node[1])) {
      wrap(s, ctx.width - 2).forEach((l, i) => push((i ? '  ' : '') + l, WHITE));
      push('', GREY);
    }
  },

  LI(node, push, ctx) {
    wrap(node[1], ctx.width - 2).forEach((l, i) => push((i ? '  ' : '- ') + l, CYAN));
    push('', GREY);
  },

  KV(node, push, ctx) {
    wrap(`${node[1]}: ${node[2]}`, ctx.width - 2).forEach((l, i) =>
      push((i ? '  ' : '') + l, LTGREY),
    );
  },

  A(node, push, ctx) {
    if (node[1] !== ctx.lastH3) for (const l of wrap(node[1], ctx.width)) push(l, LTGREEN, node[2]);
    /* don't echo the destination when the label already is it */
    const shown = pretty(node[2]);
    if (shown !== node[1]) {
      for (const l of wrap(shown, ctx.width - 2)) push(`  ${l}`, CYAN, node[2]);
    }
  },
};

export function docLines(page, width) {
  const out = [];
  const push = (t, c, u) => out.push([t, c, u]);
  const ctx = { width, lastH3: '', count: () => out.length };
  for (const node of page.nodes) {
    const handler = NODES[node[0]];
    if (handler) handler(node, push, ctx);
  }
  return tidy(out);
}

/** never stack two blank rows, and never open or close the page on one */
function tidy(out) {
  const kept = [];
  for (const ln of out) {
    if (ln[0] || (kept.length && kept[kept.length - 1][0])) kept.push(ln);
  }
  while (kept.length && !kept[kept.length - 1][0]) kept.pop();
  return kept;
}
