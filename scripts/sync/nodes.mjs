/* Turning a chunk of markup into the site's node tuples.
 *
 * The intermediate model is deliberately tiny and shared by every adapter:
 *   ["H2", text] ["H3", text] ["P", text] ["LI", text]
 *   ["KV", key, value]  ["A", label, url]
 * A source moving from HTML to markdown to a feed changes which adapter runs;
 * it must never change this shape, because `src/content/index.js` and the page
 * renderers only know about these six. */
import { children, attr, textOf, matches, query } from './dom.mjs';
import { normaliseText, normaliseUrl } from './normalise.mjs';

/** Block elements mapped to the node kind they become. */
const BLOCK = {
  h1: 'H2',
  h2: 'H2',
  h3: 'H3',
  h4: 'H3',
  h5: 'H3',
  h6: 'H3',
  p: 'P',
  blockquote: 'P',
  figcaption: 'P',
};

const CONTAINER = new Set([
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'aside',
  'nav',
  'span',
  'details',
  'summary',
  'figure',
]);

/**
 * Walk `root` and emit node tuples for the headings, paragraphs, list items
 * and links inside it. Options:
 *   `base`    resolve relative hrefs against this URL
 *   `exclude` selector for subtrees to ignore (heading anchors, nav chrome)
 *   `links`   emit `["A", label, href]` for anchors (default true)
 *   `pairs`   `[{ match, key, value }]` — elements matching `match` become a
 *             single `["KV", key, value]` instead of being walked into. This
 *             is how `article.member` on /teams/ becomes `name → country`.
 *   `deferHeadingLinks` hold a link found inside a heading until the end of
 *             the block that contains it, so a resident reads
 *             H3 name / P bio / A profile rather than H3 / A / P.
 */
export function nodesFromElement(root, options = {}) {
  const out = [];
  walk(root, out, { links: true, pairs: [], ...options });
  return out;
}

function walk(node, out, opts) {
  const pending = [];
  for (const child of children(node)) {
    if (opts.exclude && matches(child, opts.exclude)) continue;
    const pair = opts.pairs.find((rule) => matches(child, rule.match));
    if (pair) {
      pushPair(out, child, pair, opts);
      continue;
    }
    const tag = child.tagName;
    const promoted = opts.promote?.find((rule) => matches(child, rule.match));
    if (promoted) {
      if (pending.length) out.push(...pending.splice(0));
      pushText(out, promoted.kind, child, opts, pending);
      continue;
    }
    if (BLOCK[tag]) {
      // A new heading closes the previous one's deferred link.
      if (/^H\d$/.test(BLOCK[tag]) && pending.length) out.push(...pending.splice(0));
      pushText(out, BLOCK[tag], child, opts, pending);
      continue;
    }
    walkStructure(tag, child, out, opts);
  }
  out.push(...pending);
}

/**
 * An element matching a `pairs` rule collapses to one KV node. Either half may
 * be a selector into the element (`key`/`value`) or a literal (`keyText`),
 * which is how `p.sponsorship__terms` becomes `KV Tier: Exclusive`.
 */
function pushPair(out, element, rule, opts) {
  const pick = (selector) => {
    if (!selector) return '';
    const found = selector === ':self' ? element : query(element, selector);
    return found ? normaliseText(textOf(found, opts.exclude)) : '';
  };
  const key = rule.keyText ?? pick(rule.key);
  const value = rule.valueText ?? pick(rule.value);
  // /patrons/ has members with no `member__meta` at all; a half pair is worse
  // than none, so fall back to walking the block normally.
  if (key && value) out.push(['KV', key, value]);
  else if (key) out.push([rule.fallback ?? 'LI', key]);
}

/** Lists, definition lists, tables, bare links and plain containers. */
function walkStructure(tag, child, out, opts) {
  if (tag === 'ul' || tag === 'ol') return walkList(child, out, opts);
  if (tag === 'dl') return pushDefinitionList(out, child, opts);
  if (tag === 'table') return pushTable(out, child, opts);
  if (tag === 'a') return pushLink(out, child, opts);
  if (CONTAINER.has(tag)) walk(child, out, opts);
}

function walkList(list, out, opts) {
  for (const li of children(list)) {
    if (li.tagName !== 'li') continue;
    // A plain `<li>` is one line of text. An `<li>` built out of blocks — the
    // meetup rules are `<p class="rule__name">` plus a body `<p>` — is a
    // section, and flattening it would run the two together.
    if (hasBlockChild(li, opts)) walk(li, out, opts);
    else pushText(out, 'LI', li, opts);
  }
}

/** Does this list item hold block content rather than a single run of text? */
function hasBlockChild(li, opts) {
  const kids = children(li).filter((c) => !(opts.exclude && matches(c, opts.exclude)));
  const blocks = kids.filter((c) => BLOCK[c.tagName] || c.tagName === 'ul' || c.tagName === 'ol');
  return blocks.length > 1;
}

function pushText(out, kind, element, opts, pending) {
  const text = normaliseText(textOf(element, opts.exclude));
  if (text) out.push([kind, text]);
  if (!opts.links) return;
  const isHeading = /^H\d$/.test(kind);
  const sink = opts.deferHeadingLinks && isHeading && pending ? pending : out;
  for (const a of anchorsIn(element)) pushLink(sink, a, opts, text, out);
}

/** Anchors that carry a URL worth keeping — not in-page `#` heading links. */
function* anchorsIn(element) {
  for (const child of children(element)) {
    if (child.tagName === 'a') yield child;
    else yield* anchorsIn(child);
  }
}

function pushLink(sink, anchor, opts, parentText, out = sink) {
  if (!opts.links) return;
  const href = attr(anchor, 'href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
  const label = normaliseText(textOf(anchor, opts.exclude));
  if (!label) return;
  const url = normaliseUrl(href, opts.base);
  if (!url) return;
  // An anchor that is the whole of a non-heading paragraph would repeat it;
  // the link node alone carries both label and destination.
  if (parentText && parentText === label && sink === out && out.at(-1)?.[1] === label) out.pop();
  sink.push(['A', label, url]);
}

function pushDefinitionList(out, dl, opts) {
  let key = '';
  for (const child of children(dl)) {
    const text = normaliseText(textOf(child, opts.exclude));
    if (child.tagName === 'dt') key = text;
    else if (child.tagName === 'dd' && key && text) out.push(['KV', key, text]);
  }
}

/** Two-column tables are key/value pairs; anything wider becomes list items. */
function pushTable(out, table, opts) {
  for (const row of rowsOf(table)) {
    const cells = children(row)
      .filter((c) => c.tagName === 'td' || c.tagName === 'th')
      .map((c) => normaliseText(textOf(c, opts.exclude)));
    if (cells.length === 2 && cells[0] && cells[1]) out.push(['KV', cells[0], cells[1]]);
    else if (cells.some(Boolean)) out.push(['LI', cells.filter(Boolean).join(' - ')]);
  }
}

function* rowsOf(table) {
  for (const part of children(table)) {
    if (part.tagName === 'tr') yield part;
    else if (['thead', 'tbody', 'tfoot'].includes(part.tagName)) yield* rowsOf(part);
  }
}
