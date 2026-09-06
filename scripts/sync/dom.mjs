/* A very small DOM query layer over parse5.
 *
 * parse5 is a devDependency (exact) because the pages we scrape are real
 * marketing HTML: nested sections, attributes containing `>`, inline SVG and
 * `<script>` bodies. A regex tokeniser mis-nests that silently and the damage
 * only shows up as missing paragraphs weeks later. parse5 is the spec's own
 * tree construction algorithm, it has a single runtime dependency, and it
 * never runs in the browser bundle — only in `scripts/` and CI. */
import { parse, parseFragment } from 'parse5';

/** Parse a full HTML document into a tree. */
export function parseHtml(html) {
  return parse(String(html));
}

/** Parse an HTML fragment (a feed's content:encoded body, say). */
export function parseHtmlFragment(html) {
  return parseFragment(String(html));
}

const isElement = (node) => typeof node.tagName === 'string';

/** Depth-first walk over every element under `node`, `node` excluded. */
export function* descendants(node) {
  for (const child of node.childNodes ?? []) {
    if (isElement(child)) {
      yield child;
      yield* descendants(child);
    }
  }
}

/** Direct element children of `node`. */
export const children = (node) => (node.childNodes ?? []).filter(isElement);

/** Value of an attribute, or `undefined`. */
export function attr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value;
}

const classesOf = (node) => (attr(node, 'class') ?? '').split(/\s+/).filter(Boolean);

/** Parse one compound selector, e.g. `article.news-card`, `a[href]`, `#main`. */
function compound(text) {
  const parts = text.match(/^([a-z0-9-]+)?((?:[.#][\w-]+|\[[^\]]+\])*)$/i);
  if (!parts) throw new Error(`sync: unsupported selector part "${text}"`);
  const test = { tag: parts[1]?.toLowerCase(), classes: [], id: undefined, attrs: [] };
  for (const m of parts[2].matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') test.classes.push(m[2]);
    else test.id = m[2];
  }
  for (const m of parts[2].matchAll(/\[([\w-]+)(?:([~^$*]?=)"?([^\]"]*)"?)?\]/g)) {
    test.attrs.push({ name: m[1], op: m[2], value: m[3] });
  }
  return test;
}

function matchesAttr(node, { name, op, value }) {
  const actual = attr(node, name);
  if (actual === undefined) return false;
  if (!op) return true;
  if (op === '=') return actual === value;
  if (op === '^=') return actual.startsWith(value);
  if (op === '$=') return actual.endsWith(value);
  if (op === '*=') return actual.includes(value);
  return actual.split(/\s+/).includes(value);
}

function matchesCompound(node, test) {
  if (test.tag && node.tagName !== test.tag) return false;
  if (test.id && attr(node, 'id') !== test.id) return false;
  const own = classesOf(node);
  if (!test.classes.every((c) => own.includes(c))) return false;
  return test.attrs.every((a) => matchesAttr(node, a));
}

/**
 * Match one selector against a node. Supports comma groups, descendant and
 * `>` child combinators, tag/class/id/attribute tests. That is all the site's
 * markup needs; anything fancier belongs in an adapter, not a selector.
 */
export function matches(node, selector, root) {
  return selector
    .split(',')
    .some((group) => matchesSequence(node, group.trim().split(/\s+/), root));
}

function matchesSequence(node, parts, root) {
  let current = node;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (part === '>') continue;
    if (!current || !isElement(current)) return false;
    if (i === parts.length - 1) {
      if (!matchesCompound(current, compound(part))) return false;
      continue;
    }
    const child = parts[i + 1] === '>';
    current = climb(current, compound(part), child, root);
    if (!current) return false;
  }
  return true;
}

function climb(node, test, childOnly, root) {
  let parent = node.parentNode;
  while (parent && isElement(parent)) {
    if (matchesCompound(parent, test)) return parent;
    if (childOnly) return null;
    if (parent === root) return null;
    parent = parent.parentNode;
  }
  return null;
}

/** All elements under `root` matching `selector`, in document order. */
export function queryAll(root, selector) {
  const out = [];
  for (const node of descendants(root)) if (matches(node, selector, root)) out.push(node);
  return out;
}

/** First element under `root` matching `selector`, or `undefined`. */
export function query(root, selector) {
  for (const node of descendants(root)) if (matches(node, selector, root)) return node;
  return undefined;
}

const SKIP = new Set(['script', 'style', 'template', 'noscript', 'svg']);

/** All text under `node`, with skipped subtrees and `exclude` selectors dropped. */
export function textOf(node, exclude) {
  if (node.nodeName === '#text') return node.value ?? '';
  if (!isElement(node) && !node.childNodes) return '';
  if (isElement(node) && SKIP.has(node.tagName)) return '';
  if (isElement(node) && exclude && matches(node, exclude)) return '';
  let out = '';
  for (const child of node.childNodes ?? []) out += textOf(child, exclude);
  return out;
}
