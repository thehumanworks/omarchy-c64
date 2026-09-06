// The content layer, imported straight into the test process.
//
// `src/content/index.js` is a pure module (see docs/ARCHITECTURE.md), so the
// suites can read exactly the data the page was built from — already uppercased
// and quote-folded — instead of repeating strings that would rot the moment
// somebody edits `content/`. Everything a table-driven suite needs to know
// about a page is derived here, with the same arithmetic the renderers use.
import { menu, pages, shortcuts, strings } from '../../../src/content/index.js';
import { docLines } from '../../../src/machine/doc-lines.js';
import { wrap } from '../../../src/text/wrap.js';

export { menu, pages, shortcuts, strings };

/** `navigate.js` lays a document out this wide; `doc.js` clips rows to it too. */
export const docWidth = (cols) => cols - 6;

/** Rows of a document visible at once: `doc.js` boxes it between 1 and rows-4. */
export const boxInner = (rows) => rows - 6;

/** How `doc.js` clips a title into the box header. */
export const docTitle = (page, cols) => page.title.slice(0, cols - 8);

/**
 * Every menu entry that opens on the tube rather than in a tab, with the number
 * you type at the READY prompt. One row per test.
 */
export const DOC_ENTRIES = menu
  .map((entry, i) => ({ number: i + 1, label: entry.label, page: pages[entry.label] }))
  .filter((row) => row.page);

/** The first H2 as it lands on screen: wrapped, first line. */
export function firstHeading(page, cols) {
  const h2 = page.nodes.find((node) => node[0] === 'H2');
  return h2 ? wrap(h2[1], docWidth(cols))[0] : null;
}

/** How many of the page's rows carry a URL, i.e. how many hit boxes it can make. */
export const linkRowCount = (page, cols) =>
  docLines(page, docWidth(cols)).filter((line) => line[2]).length;

/** How many rows the whole document occupies at this width. */
export const docRowCount = (page, cols) => docLines(page, docWidth(cols)).length;
