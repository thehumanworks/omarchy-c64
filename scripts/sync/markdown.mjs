/* A deliberately small markdown reader: only the constructs the node model
 * has a home for. Headings, paragraphs, list items, links and two-column
 * tables become node tuples; code fences, images and HTML blocks are dropped,
 * because a 40-column PETSCII screen has nothing to do with them. */
import { normaliseText, normaliseUrl } from './normalise.mjs';

/** Strip YAML front matter, returning `{ meta, body }`. */
export function frontMatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { meta: {}, body: source };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: source.slice(match[0].length) };
}

/** Flatten inline markdown to plain text: links to their label, emphasis away. */
export function inlineText(markdown) {
  return normaliseText(
    String(markdown)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, '$1$2')
      .replace(/<[^>]+>/g, ''),
  );
}

/** Every `[label](url)` in a run of markdown. */
export function inlineLinks(markdown, base) {
  const out = [];
  for (const m of String(markdown).matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)) {
    const label = inlineText(m[1]);
    const url = normaliseUrl(m[2], base);
    if (label && url) out.push(['A', label, url]);
  }
  return out;
}

/** Split a markdown body into blocks, dropping fenced code. */
function blocks(body) {
  const lines = String(body).split(/\r?\n/);
  const out = [];
  let fence = null;
  let buffer = [];
  const flush = () => {
    if (buffer.length) out.push(buffer.join('\n'));
    buffer = [];
  };
  for (const line of lines) {
    const fenceMark = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (fenceMark && line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (fenceMark) {
      flush();
      fence = fenceMark[1];
      continue;
    }
    if (!line.trim()) flush();
    else buffer.push(line);
  }
  flush();
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

/**
 * Convert a markdown document to node tuples.
 * `links: false` suppresses `["A", ...]` nodes (a manual chapter's inline
 * links would otherwise bury the prose).
 */
export function nodesFromMarkdown(source, { base, links = true, headingShift = 0 } = {}) {
  const { body } = frontMatter(source);
  const out = [];
  for (const block of blocks(body)) emitBlock(block, out, { base, links, headingShift });
  return out;
}

function emitBlock(block, out, opts) {
  const lines = block.split('\n');
  if (lines.some((l) => TABLE_RULE.test(l))) return emitTable(lines, out);
  // Markdown hard-wraps paragraphs across several source lines; they are one
  // paragraph, so consecutive plain lines are joined before being emitted.
  // Headings and bullets end the run.
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) emitParagraph(paragraph.join(' '), out, opts);
    paragraph = [];
  };
  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      emitHeading(heading, out, opts);
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      emitItem('LI', bullet[1], out, opts);
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
}

function emitHeading(match, out, opts) {
  const level = Math.min(6, match[1].length + opts.headingShift);
  const text = inlineText(match[2].replace(/\s*#+\s*$/, ''));
  // A chapter's `#` is the page's own heading (H2); everything under it is H3.
  if (text) out.push([level <= 1 ? 'H2' : 'H3', text]);
}

const emitParagraph = (source, out, opts) => emitItem('P', source, out, opts);

function emitItem(kind, source, out, opts) {
  const text = inlineText(source);
  if (text) out.push([kind, text]);
  if (opts.links) out.push(...inlineLinks(source, opts.base));
}

function emitTable(lines, out) {
  for (const line of lines) {
    if (TABLE_RULE.test(line) || !line.includes('|')) continue;
    const cells = line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => inlineText(c));
    if (cells.length === 2 && cells[0] && cells[1]) out.push(['KV', cells[0], cells[1]]);
    else if (cells.some(Boolean)) out.push(['LI', cells.filter(Boolean).join(' - ')]);
  }
}
