/**
 * Unicode → C64 screen code, and the handful of glyphs the UI draws by name.
 * Owns: the screen-code table. Pure; must not import anything.
 *
 * Characters in the private use area U+E000+n mean "screen code n" verbatim,
 * which is how the box-drawing glyphs below are addressed.
 */

/** Screen code for one character. Anything unknown becomes a space. */
export function scode(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 0xe000) return c - 0xe000;
  if (c === 64) return 0;
  if (c >= 65 && c <= 90) return c - 64;
  if (c >= 97 && c <= 122) return c - 96;
  if (c === 91) return 27;
  if (c === 93) return 29;
  if (c === 94) return 30;
  if (c === 163) return 28;
  if (c === 183) return 122;
  if (c >= 32 && c <= 63) return c;
  if (c === 95) return 100;
  return 32;
}

/** Screen codes for a whole string, iterated by code point. */
export function codes(str) {
  const a = [];
  for (const ch of str) a.push(scode(ch));
  return a;
}

/** The private-use escape for a raw screen code. */
export const G = (n) => String.fromCharCode(0xe000 + n);

export const HLINE = G(64);
export const VLINE = G(93);
export const TL = G(112);
export const TR = G(110);
export const BL = G(109);
export const BR = G(125);
export const BLOCK = G(160);
