/**
 * The 1702's case is a stretchable nine-slice, not one flat quad, so it can
 * fill any viewport without smearing the bezel curve, the Commodore badge or
 * the knobs. Bands marked 'f' are pinned to their pixel size, 's' bands are
 * plain plastic that soaks up the slack, and 'S' is the tube aperture itself.
 *
 * Pure maths only — no three.js, no DOM. The geometry builder that turns a
 * solved case into a mesh lives in `case-geometry.js`.
 */

export const TEXW = 1162;
export const TEXH = 1000;

/** The punched aperture, in texture pixels. */
export const AP = { x0: 93, x1: 1070, y0: 116, y1: 823 };

export const COLB = [
  [0, 45, 'f'],
  [45, 80, 's'],
  [80, 150, 'f'],
  [150, 1010, 'S'],
  [1010, 1085, 'f'],
  [1085, 1120, 's'],
  [1120, 1162, 'f'],
];

const ROWB = [
  [0, 45, 'f'],
  [45, 85, 's'],
  [85, 175, 'f'],
  [175, 765, 'S'],
  [765, 845, 'f'],
  [845, 872, 's'],
  [872, 1000, 'f'],
];

/** badge | gap | knobs */
const STRB = [
  [0, 500, 'f'],
  [500, 650, 's'],
  [650, 1162, 'f'],
];

/** plausible tube shapes */
export const GLASS_MIN = 0.4;
export const GLASS_MAX = 1.7;

/**
 * Lay a list of band definitions across `total` world units: fixed bands keep
 * `(t1 - t0) * u`, the aperture takes `mid`, and the stretchy bands share what
 * is left in proportion to their natural size.
 */
export function solveBands(defs, total, u, mid) {
  let fixed = 0;
  let sNat = 0;
  for (const d of defs) {
    const n = (d[1] - d[0]) * u;
    if (d[2] === 'f') fixed += n;
    else if (d[2] === 's') sNat += n;
  }
  const slack = Math.max(0, total - fixed - mid);
  const out = [];
  let p = 0;
  for (const d of defs) {
    const n = (d[1] - d[0]) * u;
    const size = d[2] === 'S' ? mid : d[2] === 's' ? (sNat > 0 ? (slack * n) / sNat : 0) : n;
    out.push({ t0: d[0], t1: d[1], a: p, b: p + size });
    p += size;
  }
  return out;
}

/** Texture coordinate `t` → world offset along a solved band list. */
export function bandAt(bands, t) {
  for (const b of bands) if (t <= b.t1) return b.a + (b.b - b.a) * ((t - b.t0) / (b.t1 - b.t0));
  return bands[bands.length - 1].b;
}

export const mapX = (cs, t) => -cs.w / 2 + bandAt(cs.cols, t);
export const mapY = (cs, t) => cs.h / 2 - bandAt(cs.rows, t);

/** Pick the texel scale that keeps the badge and the knob cluster readable. */
function texelScale(cw, ch) {
  const stripFix = 500 + (TEXW - 650); /* badge + knob cluster */
  const colFix = 45 + 70 + 75 + 42; /* pinned side bands   */
  const u = Math.min(0.001, (cw - 0.03) / stripFix, (cw - 0.06) / colFix, ch / 900);
  return { u: Math.max(u, 0.00016), colFix };
}

/** Solve the whole case for a viewport `cw` x `ch` world units. */
export function solveCase(cw, ch) {
  const { u, colFix } = texelScale(cw, ch);
  const edgeW = colFix * u;
  const edgeH = (45 + 90 + 80 + 128) * u;
  let midW = Math.max(0.04, cw - edgeW - 70 * u);
  let midH = Math.max(0.04, ch - edgeH - 67 * u);
  const lipW = (150 - AP.x0 + AP.x1 - 1010) * u; /* aperture inside the pins */
  const lipH = (175 - AP.y0 + AP.y1 - 765) * u;
  let apW = midW + lipW;
  let apH = midH + lipH;
  const a = apW / apH;
  if (a > GLASS_MAX) {
    apW = apH * GLASS_MAX;
    midW = Math.max(0.04, apW - lipW);
  } else if (a < GLASS_MIN) {
    apH = apW / GLASS_MIN;
    midH = Math.max(0.04, apH - lipH);
  }
  const cs = {
    w: cw,
    h: ch,
    u,
    cols: solveBands(COLB, cw, u, midW),
    rows: solveBands(ROWB, ch, u, midH),
    strip: solveBands(STRB, cw, u, 0),
    oy: ch / 2 - 0.508 /* crop the top, keep the knobs */,
    ap: { x: 0, y: 0, w: 1, h: 1 },
  };
  const x0 = mapX(cs, AP.x0);
  const x1 = mapX(cs, AP.x1);
  const y0 = mapY(cs, AP.y0);
  const y1 = mapY(cs, AP.y1);
  cs.ap = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y0 - y1 };
  return cs;
}
