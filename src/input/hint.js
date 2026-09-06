/**
 * The hardware label pill that follows what you point at.
 * Owns the `#hint` element. Imports nothing.
 */

export function createHint(el) {
  let shown = '';
  return function setHint(t) {
    if (t === shown) return;
    shown = t;
    el.textContent = t || '';
    el.classList.toggle('on', !!t);
  };
}
