/* Adapter: RSS 2.0 / Atom. Used for NEWS.
 *
 * Reproduces the tube's existing news shape, one block per item:
 *   ["H3", title] ["KV", "Date", "August 28, 2026"] ["P", summary]
 *   ["A", "Read more", link]
 *
 * Source options: `limit`, `lead` (an opening H2), `dateLabel`, `readMore`,
 * `maxParagraph`.
 */
import { parseHtmlFragment, textOf } from '../dom.mjs';
import { normaliseText, normaliseNodes } from '../normalise.mjs';

/** Pull `<tag>…</tag>` bodies out of a feed. A feed is XML, not HTML: parse5
 * would coerce it into a body/head document, so a scoped regex is both simpler
 * and more honest here. CDATA is unwrapped. */
function tagBodies(xml, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...xml.matchAll(pattern)].map((m) => unwrapCdata(m[1]));
}

function tagBody(xml, ...tags) {
  for (const tag of tags) {
    const [first] = tagBodies(xml, tag);
    if (first !== undefined && first.trim()) return first;
  }
  return '';
}

const unwrapCdata = (text) => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

/** Atom puts the URL in `<link href="...">`; RSS puts it in the element body. */
function linkOf(itemXml) {
  const href = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(itemXml);
  if (href) return href[1];
  return tagBody(itemXml, 'link').trim();
}

/** Feed dates are RFC 822 (RSS) or ISO 8601 (Atom); print them as the site does. */
export function formatDate(raw) {
  const date = new Date(String(raw).trim());
  if (Number.isNaN(date.getTime())) return normaliseText(raw);
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Strip markup from a summary that arrived as escaped or literal HTML. */
function summaryText(raw) {
  if (!raw) return '';
  return normaliseText(textOf(parseHtmlFragment(normaliseText(raw))));
}

export async function fetchNodes(source, deps) {
  const xml = await deps.fetchText(source.url);
  return nodesFromFeed(xml, source);
}

/** The pure half, driven from a fixture by the unit tests. */
export function nodesFromFeed(xml, source = {}) {
  const items = [...tagBodies(xml, 'item'), ...tagBodies(xml, 'entry')];
  const nodes = source.lead ? [['H2', source.lead]] : [];
  for (const item of items.slice(0, source.limit ?? items.length)) {
    const title = normaliseText(tagBody(item, 'title'));
    if (!title) continue;
    nodes.push(['H3', title]);
    const date = tagBody(item, 'pubDate', 'published', 'updated', 'dc:date');
    if (date) nodes.push(['KV', source.dateLabel ?? 'Date', formatDate(date)]);
    const summary = summaryText(tagBody(item, 'description', 'summary'));
    if (summary) nodes.push(['P', summary]);
    const link = linkOf(item);
    if (link) nodes.push(['A', source.readMore ?? 'Read more', link]);
  }
  return {
    title: source.title ?? normaliseText(tagBody(xml, 'title')).toUpperCase(),
    url: source.url,
    nodes: normaliseNodes(nodes, { base: source.url, maxParagraph: source.maxParagraph }),
  };
}
