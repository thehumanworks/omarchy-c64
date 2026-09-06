/**
 * A keyboard changes the visual viewport, not the monitor's character grid.
 * Pin the canvas geometry for a typing session; only the editable command
 * follows the visible bottom edge. No keyboard-sized spacer or page scaling.
 */
export function createNativeViewport({ canvas, input, layout }) {
  const vv = window.visualViewport;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let locked = false;
  let focused = false;

  function position() {
    const top = vv?.offsetTop || 0;
    const visible = vv?.height || window.innerHeight;
    canvas.style.top = `${top}px`;
    const keyboard = visible < height - 120;
    input.style.top = `${keyboard ? Math.max(top, top + visible - input.offsetHeight - 8) : top + 8}px`;
  }

  function resize() {
    // A width change is rotation/window resizing, not a software keyboard.
    if (width !== window.innerWidth) {
      input.blur();
      locked = false;
    }
    if (locked && width === window.innerWidth && (focused || window.innerHeight < height)) {
      position();
      return;
    }
    locked = false;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    position();
    layout();
  }

  window.addEventListener('resize', resize);
  vv?.addEventListener('resize', position);
  vv?.addEventListener('scroll', position);
  resize();
  return {
    focus() {
      locked = true;
      focused = true;
      position();
    },
    blur() {
      focused = false;
      resize();
    },
  };
}
