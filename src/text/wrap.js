/**
 * Word wrapping and the small text helpers the page renderers share.
 * Owns: `wrap`, `sentences`, `pretty`. Pure; must not import anything.
 */

/** Greedy word wrap. Words longer than `w` are split across lines. */
export function wrap(text, w) {
  const out = [];
  let line = '';
  const flush = () => {
    if (line.length) {
      out.push(line);
      line = '';
    }
  };
  for (let word of String(text).split(' ')) {
    while (word.length > w) {
      flush();
      out.push(word.slice(0, w));
      word = word.slice(w);
    }
    if (!line.length) line = word;
    else if (line.length + 1 + word.length <= w) line += ` ${word}`;
    else {
      flush();
      line = word;
    }
  }
  flush();
  return out.length ? out : [''];
}

/**
 * Split a paragraph into sentences so body copy lands in short blocks with air
 * between them. Very short sentences ride along with the previous one so the
 * page doesn't turn into confetti.
 */
export function sentences(text) {
  const out = [];
  let buf = '';
  for (const part of String(text).split(/(?<=[.!?])\s+/)) {
    if (!part) continue;
    if (buf && buf.length + 1 + part.length <= 30) {
      buf += ` ${part}`;
      continue;
    }
    if (buf) out.push(buf);
    buf = part;
  }
  if (buf) out.push(buf);
  return out;
}

/** mailto query strings and scheme noise are not worth a line of a C64 screen */
export function pretty(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^mailto:/i, '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .toUpperCase();
}
