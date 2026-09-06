/* The shared normalisation step every adapter runs its text through.
 *
 * The tube is a 40-column PETSCII screen: it has straight quotes, one kind of
 * hyphen and no typographic niceties. Text arriving from HTML, markdown or a
 * feed is squeezed into that alphabet here, once, so no adapter has to think
 * about it. Case is deliberately preserved: `src/content/index.js` uppercases
 * at load, and keeping mixed case in the JSON keeps it readable in review. */

/* The HTML 4 Latin-1 block, U+00A0 to U+00FF, in code-point order. Names come
 * through as `&uuml;` on the teams page and as `&eacute;` in news summaries;
 * spelling out the block is duller than pulling in an entity library, but it
 * costs one line and no dependency. The characters it yields are folded to
 * ASCII a step later, so `&uuml;` still ends up as `u`. */
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn ' +
  'sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave ' +
  'Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN ' +
  'szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave ' +
  'iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ' +
  'ucirc uuml yacute thorn yuml';

/** Named HTML entities worth resolving; anything else falls through as-is. */
const NAMED = {
  ...Object.fromEntries(
    LATIN1.split(' ').map((name, i) => [name, String.fromCodePoint(0x00a0 + i)]),
  ),
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  laquo: '"',
  raquo: '"',
  copy: '(c)',
  reg: '(r)',
  trade: '(tm)',
  deg: ' degrees',
  eacute: 'e',
  middot: '-',
  bull: '-',
  times: 'x',
  shy: '',
  zwj: '',
  zwnj: '',
};

/** Non-ASCII characters the C64 charset cannot show, and their stand-ins. */
const FOLD = [
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2010-\u2015\u2212]/g, '-'],
  [/\u2026/g, '...'],
  [/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' '],
  [/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, ''],
  [/[\u2022\u00B7\u25CF\u25AA]/g, '-'],
  [/\u00D7/g, 'x'],
  [/\u2122/g, '(tm)'],
  [/\u00A9/g, '(c)'],
  [/\u00AE/g, '(r)'],
];

/** Resolve numeric and named HTML entities. */
export function decodeEntities(input) {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
      const hit = NAMED[name.toLowerCase()];
      return hit === undefined ? m : hit;
    });
}

function safeCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Strip accents so `Bjørn` reads as `Bjorn` rather than as a missing glyph. */
function deaccent(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/\u00F8/g, 'o')
    .replace(/\u00D8/g, 'O')
    .replace(/\u00E6/g, 'ae')
    .replace(/\u00C6/g, 'AE')
    .replace(/\u00DF/g, 'ss')
    .replace(/[\u0111\u00F0]/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/\u0142/g, 'l')
    .replace(/\u0141/g, 'L');
}

/**
 * Normalise one run of text: entities resolved, typography folded to ASCII,
 * whitespace collapsed to single spaces, ends trimmed.
 */
export function normaliseText(input) {
  if (input === null || input === undefined) return '';
  let text = decodeEntities(String(input));
  for (const [pattern, replacement] of FOLD) text = text.replace(pattern, replacement);
  text = deaccent(text);
  // Drop anything still outside printable ASCII rather than shipping a glyph
  // the character ROM cannot draw.
  text = text.replace(/[^\x20-\x7E]+/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

/** Truncate on a word boundary, appending an ellipsis. Used only when asked. */
export function capLength(text, max) {
  if (!max || text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, '')}...`;
}

/** A URL is kept verbatim apart from whitespace; entity-decoding `&amp;` matters. */
export function normaliseUrl(input, base) {
  const raw = decodeEntities(String(input ?? '')).trim();
  if (!raw) return '';
  try {
    return base ? new URL(raw, base).href : new URL(raw).href;
  } catch {
    return raw;
  }
}

/**
 * Normalise a whole node tuple in place-free fashion.
 * `["P", text]`, `["H2"|"H3"|"LI", text]`, `["KV", key, value]`, `["A", label, url]`.
 * `maxParagraph` caps P nodes only, and only when a source opts in — the
 * current pages carry full-length paragraphs, so the default is no cap.
 */
export function normaliseNode(node, { maxParagraph = 0, base } = {}) {
  const [kind] = node;
  if (kind === 'A') return ['A', normaliseText(node[1]), normaliseUrl(node[2], base)];
  if (kind === 'KV') return ['KV', normaliseText(node[1]), normaliseText(node[2])];
  const text = normaliseText(node[1]);
  return [kind, kind === 'P' ? capLength(text, maxParagraph) : text];
}

/** Normalise a list of nodes and drop the ones that ended up empty. */
export function normaliseNodes(nodes, options = {}) {
  const out = [];
  for (const node of nodes ?? []) {
    if (!Array.isArray(node) || !node[0]) continue;
    const clean = normaliseNode(node, options);
    if (clean[0] === 'A' ? clean[2] : clean[1]) out.push(clean);
  }
  return out;
}
