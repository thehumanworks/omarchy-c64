// Reading the tube the way the machine writes it.
//
// `screenText()` hands back one string per row, but a row is really screen
// codes: the character ROM has 64 glyphs, so anything it cannot draw comes back
// as `·`. An assertion written against the raw content ("OMARCHY 4.0.1 /
// X86_64") would therefore never match the row on screen ("... X86·64"). Every
// expectation in these suites goes through `asTube` first, so the test compares
// what the tube can actually say.
import { expect } from '@playwright/test';
import { scode } from '../../../src/text/petscii.js';
import { hasHook, openSite, skipBoot } from './page.js';

/**
 * The screen-code round trip `TextBuffer.line()` performs, applied to a string.
 * Mirrors the private `fromCode` in `src/screen/text-buffer.js`: the pair is
 * the readback contract the e2e suite asserts against.
 */
export function asTube(text) {
  let out = '';
  for (const ch of String(text)) {
    const c = scode(ch);
    if (c === 0) out += '@';
    else if (c >= 1 && c <= 26) out += String.fromCharCode(c + 64);
    else if (c >= 32 && c <= 63) out += String.fromCharCode(c);
    else if (c === 27) out += '[';
    else if (c === 29) out += ']';
    else if (c === 30) out += '^';
    else out += '·';
  }
  return out;
}

/** How a box rail (`HLINE`, screen code 64) reads back. */
export const RAIL = '·';

/**
 * Open the built page, get to the main menu, and fail loudly on a hookless
 * build. Returns the live array of page errors `openSite` collects.
 */
export async function atMenu(page, viewport) {
  const errors = await openSite(page, viewport ? { viewport } : {});
  expect(await hasHook(page), 'window.__omarchy test hook is missing').toBe(true);
  await skipBoot(page);
  return errors;
}

/** The first row that contains `needle`, or -1. */
export const rowWith = (rows, needle) => rows.findIndex((r) => r.includes(needle));

/** True when the row is a box rail: blank margins, `·` everywhere between them. */
export function isRail(row, cols) {
  return row.length === cols && row[0] === ' ' && row.slice(1, -1) === RAIL.repeat(cols - 2);
}
