/* Adapter: scrape a rendered omarchy.org page.
 *
 * Used for /air/, /security/, /teams/, /patrons/ and /sponsorships/, which
 * have no machine-readable source of any kind (see docs/CONTENT-SOURCES.md).
 * Everything page-specific lives in `content/sources.json` as selectors, so
 * a markup rename is a config change rather than a code change.
 *
 * Source options:
 *   `root`    container selector, default `main`
 *   `title`   selector for the page title, default `header h1`
 *   `exclude` selector for subtrees to skip
 *   `pairs`   `[{match, key, value}]` → `["KV", key, value]`
 *   `deferHeadingLinks`, `links`  passed through to the walker
 *   `prepend` / `append`  literal node tuples, for links the markup lacks
 */
import { parseHtml, query, textOf } from '../dom.mjs';
import { nodesFromElement } from '../nodes.mjs';
import { normaliseText, normaliseNodes } from '../normalise.mjs';

export async function fetchNodes(source, deps) {
  const html = await deps.fetchText(source.url);
  return nodesFromHtml(html, source);
}

/** The pure half, so tests can drive it from a fixture with no network. */
export function nodesFromHtml(html, source = {}) {
  const doc = parseHtml(html);
  const root = query(doc, source.root ?? 'main');
  if (!root) {
    throw new Error(`sync: no element matched "${source.root ?? 'main'}" at ${source.url}`);
  }
  const walked = nodesFromElement(root, {
    base: source.url,
    exclude: source.exclude,
    pairs: source.pairs ?? [],
    links: source.links ?? true,
    deferHeadingLinks: source.deferHeadingLinks ?? false,
  });
  const heading = headingOf(doc, source);
  const title = source.title ?? heading.toUpperCase();
  const nodes = normaliseNodes(
    [
      // The page's `<h1>` sits outside the content root. By default it opens
      // the page as an H2 unless it is already doing duty as the page title,
      // which is how /air/ keeps "Artists in Residence" while /security/ does
      // not repeat "Security at Omarchy" twice. `lead` overrides either way.
      ...(wantsLead(heading, title, source.lead) ? [['H2', heading]] : []),
      ...(source.prepend ?? []),
      ...walked,
      ...(source.append ?? []),
    ],
    { base: source.url, maxParagraph: source.maxParagraph },
  );
  return { title, url: source.url, nodes };
}

function wantsLead(heading, title, lead) {
  if (!heading || lead === false) return false;
  if (lead === true) return true;
  return heading.toUpperCase() !== title;
}

function headingOf(doc, source) {
  const heading = query(doc, source.headingSelector ?? 'header.header h1');
  return normaliseText(heading ? textOf(heading) : '');
}
