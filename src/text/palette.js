/**
 * The 16 VIC-II colours, by index and by name.
 * Owns: the palette table and the colour names content files may use.
 * Must not import anything (leaf module, no DOM).
 */

export const PAL = [
  [0, 0, 0],
  [255, 255, 255],
  [129, 51, 56],
  [117, 206, 200],
  [142, 60, 151],
  [86, 172, 77],
  [46, 44, 155],
  [237, 241, 113],
  [142, 80, 41],
  [85, 56, 0],
  [196, 108, 113],
  [74, 74, 74],
  [123, 123, 123],
  [169, 255, 159],
  [112, 109, 235],
  [178, 178, 178],
];

export const CSS = PAL.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);

export const WHITE = 1;
export const CYAN = 3;
export const PURPLE = 4;
export const BLUE = 6;
export const YELLOW = 7;
export const LTRED = 10;
export const GREY = 12;
export const LTGREEN = 13;
export const LTBLUE = 14;
export const LTGREY = 15;

const NAMES = {
  BLACK: 0,
  WHITE,
  RED: 2,
  CYAN,
  PURPLE,
  GREEN: 5,
  BLUE,
  YELLOW,
  ORANGE: 8,
  BROWN: 9,
  LTRED,
  DKGREY: 11,
  GREY,
  LTGREEN,
  LTBLUE,
  LTGREY,
};

/** Map a colour name used in `content/*.json` onto its palette index. */
export function colorIndex(name) {
  const i = NAMES[name];
  if (i === undefined) throw new Error(`unknown colour name: ${name}`);
  return i;
}
