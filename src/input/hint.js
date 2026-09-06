/** Pointer labels are metadata for picking tests; no floating UI is drawn. */
export function createHint(canvas) {
  canvas.dataset.hint = '';
  return function setHint(text) {
    if (canvas.dataset.hint !== text) canvas.dataset.hint = text || '';
  };
}
