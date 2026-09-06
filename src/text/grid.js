/**
 * Picks the character grid that matches the shape of the tube, so the picture
 * fills the glass instead of floating in a sea of border. A phone held upright
 * gets a genuinely portrait terminal, not a squashed landscape one.
 * Owns: the aspect → grid rule. Must not import anything.
 */

/** @param {number} a aspect ratio (width / height) of the tube aperture */
export function gridFor(a) {
  const cols = a >= 1.25 ? 40 : a >= 0.98 ? 36 : a >= 0.72 ? 34 : 30;
  return { cols, rows: Math.max(25, Math.min(60, Math.round(cols / a))) };
}
