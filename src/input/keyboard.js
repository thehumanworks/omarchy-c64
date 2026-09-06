/**
 * The keyboard: cursor keys, RETURN, the document scroll keys and the BASIC
 * prompt itself. Every branch is a small handler so no one function grows.
 * Imports only the callbacks main.js injects.
 */

const SCROLL_KEYS = [' ', 'PageDown', 'PageUp', 'Home', 'End'];

const count = (k) => k.content.menu.length;

function arrows(k, key) {
  const { machine } = k;
  if (machine.page === 'doc') {
    const step = key === 'ArrowUp' || key === 'ArrowDown' ? 1 : 10;
    machine.doc.off += key === 'ArrowUp' || key === 'ArrowLeft' ? -step : step;
    k.snd.beep(1900, 0.014, 'square', 0.03);
    return;
  }
  const n = count(k);
  if (machine.page !== 'menu') machine.page = 'menu';
  if (key === 'ArrowUp') machine.sel = (machine.sel + n - 1) % n;
  else if (key === 'ArrowDown') machine.sel = (machine.sel + 1) % n;
  else machine.sel = (machine.sel + (n >> 1)) % n;
  machine.status = '';
  k.snd.beep(1900, 0.018, 'square', 0.04);
}

function enter(k) {
  const { machine } = k;
  k.snd.beep(1100, 0.028, 'square', 0.055);
  if (machine.input.trim()) {
    const v = machine.input;
    machine.input = '';
    k.run(v);
  } else if (machine.page === 'menu') k.nav.launch(machine.sel);
  else {
    machine.page = 'menu';
    machine.status = '';
  }
}

function scroll(k, key) {
  const { machine } = k;
  const jump = k.buffer.rows - 8;
  if (key === 'Home') machine.doc.off = 0;
  else if (key === 'End') machine.doc.off = machine.doc.lines.length;
  else machine.doc.off += key === 'PageUp' ? -jump : jump;
  k.snd.beep(1500, 0.02, 'square', 0.04);
}

const EDIT = {
  Backspace(k) {
    k.machine.input = k.machine.input.slice(0, -1);
    k.snd.key();
  },
  Escape(k) {
    k.machine.input = '';
    k.machine.page = 'menu';
    k.machine.status = '';
  },
};

function tab(k, shift) {
  k.machine.page = 'menu';
  k.machine.sel = (k.machine.sel + (shift ? count(k) - 1 : 1)) % count(k);
}

function typeChar(k, key) {
  if (k.machine.input.length < 30) k.machine.input += key.toUpperCase();
  k.snd.key();
}

const done = (fn) => {
  fn();
  return true;
};

/** Returns true when the key was handled and the default must be prevented. */
function route(k, e) {
  const key = e.key;
  if (key.startsWith('Arrow')) return done(() => arrows(k, key));
  if (key === 'Enter') return done(() => enter(k));
  if (k.machine.page === 'doc' && !k.machine.input && SCROLL_KEYS.includes(key)) {
    return done(() => scroll(k, key));
  }
  if (EDIT[key]) return done(() => EDIT[key](k));
  if (key === 'Tab') return done(() => tab(k, e.shiftKey));
  if (key.length === 1 && key >= ' ' && key <= '~') return done(() => typeChar(k, key));
  return false;
}

/** The states that swallow every key: powered off, booting, or in the maze. */
function preflight(k, e) {
  const { machine } = k;
  if (!machine.powered) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      k.togglePower();
    }
    return true;
  }
  if (machine.mode === 'boot') {
    e.preventDefault();
    k.boot.skipBoot();
    k.snd.key();
    return true;
  }
  if (machine.page === 'maze') {
    e.preventDefault();
    k.run('RUN');
    k.snd.key();
    return true;
  }
  return false;
}

/**
 * `deps` is `{ machine, content, snd, nav, boot, run, wake, togglePower,
 * buffer }`.
 */
export function createKeyboard(deps) {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    deps.wake();
    if (preflight(deps, e)) return;
    if (route(deps, e)) e.preventDefault();
  });
}
