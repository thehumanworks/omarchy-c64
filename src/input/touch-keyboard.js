/**
 * The on-screen keyboard for touch screens: a fixed overlay panel that types
 * through the very same `press()` the physical keyboard uses, plus an echo
 * strip that mirrors the READY prompt the panel covers.
 * Pure DOM — it never touches WebGL, the canvas or the text grid, so opening
 * and closing it cannot shift the layout.
 * Owns `#kbd`, `#kbd-toggle` and the `kbd-open` body class. Imports nothing.
 */

const STORE = 'om64.kbd';
const CURSOR = '█';

/** rows 1-4: ten plain keys each, two grid columns per key */
const TYPING = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL:', 'ZXCVBNM,.?'];

/** the control row: `[label, key, columns]`, twenty columns in total */
const CONTROL = [
  ['RUN/STOP', 'Escape', 3],
  ['$', '$', 1],
  ['"', '"', 1],
  ['←', 'ArrowLeft', 1],
  ['↑', 'ArrowUp', 1],
  ['↓', 'ArrowDown', 1],
  ['→', 'ArrowRight', 1],
  ['SPACE', ' ', 4],
  ['⌫', 'Backspace', 2],
  ['RETURN', 'Enter', 3],
  ['▼', null, 2],
];

/** keys that repeat while held, and the two delays that shape the repeat */
const REPEATS = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'Backspace'];
const REPEAT_FIRST = 420;
const REPEAT_EVERY = 90;

const read = () => {
  try {
    return window.localStorage.getItem(STORE) === 'on';
  } catch (err) {
    return false;
  }
};

const write = (on) => {
  try {
    window.localStorage.setItem(STORE, on ? 'on' : 'off');
  } catch (err) {
    /* private mode, or storage is full: the panel still works */
  }
};

/** True on a phone, a tablet or a laptop with a touch screen. */
function coarse() {
  const mq = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return !!mq || navigator.maxTouchPoints > 0;
}

function makeKey(label, span, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.style.gridColumn = `span ${span}`;
  b.setAttribute('aria-label', label);
  return b;
}

/** Hold a key down and it repeats, like a real one. Returns a stop function. */
function autoRepeat(fire) {
  let timer = 0;
  const tick = () => {
    fire();
    timer = window.setTimeout(tick, REPEAT_EVERY);
  };
  timer = window.setTimeout(tick, REPEAT_FIRST);
  return () => window.clearTimeout(timer);
}

/** Wire one key: pointerdown types it, and nothing ever takes focus. */
function bindKey(k, btn, key) {
  let stop = null;
  const release = () => {
    if (stop) stop();
    stop = null;
    btn.classList.remove('down');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('down');
    k.tap(key);
    if (REPEATS.includes(key)) stop = autoRepeat(() => k.tap(key));
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    btn.addEventListener(ev, release);
  }
}

function buildRows(k, panel) {
  for (const row of TYPING) {
    const el = document.createElement('div');
    el.className = 'kbd-row';
    for (const ch of row) {
      const btn = makeKey(ch, 2, 'kbd-key');
      bindKey(k, btn, ch);
      el.appendChild(btn);
    }
    panel.appendChild(el);
  }
  const ctl = document.createElement('div');
  ctl.className = 'kbd-row';
  for (const [label, key, span] of CONTROL) {
    const btn = makeKey(label, span, key ? 'kbd-key kbd-ctl' : 'kbd-key kbd-hide');
    bindKey(k, btn, key);
    ctl.appendChild(btn);
  }
  panel.appendChild(ctl);
}

/** The line the panel hides: `READY. <input>`, with the status above it. */
function echoText(machine) {
  if (!machine.powered) return '';
  const prompt = `READY. ${machine.input}${CURSOR}`;
  return machine.status ? `${machine.status}\n${prompt}` : prompt;
}

/**
 * `deps` is `{ press, machine, wake }`.
 * Returns `{ open, close, toggle, isOpen, sync }`.
 */
export function createTouchKeyboard(deps) {
  const panel = document.getElementById('kbd');
  const pill = document.getElementById('kbd-toggle');
  const echo = document.createElement('div');
  let shown = null;
  let open = false;

  const k = {
    tap(key) {
      deps.wake();
      if (key === null) return setOpen(false);
      deps.press(key);
      sync();
    },
  };

  function setOpen(on) {
    open = on;
    panel.hidden = !on;
    document.body.classList.toggle('kbd-open', on);
    pill.setAttribute('aria-label', on ? 'Hide keyboard' : 'Show keyboard');
    pill.setAttribute('aria-pressed', String(on));
    write(on);
    if (on) sync();
  }

  /** Mirror the READY prompt onto the strip. Cheap: a string compare. */
  function sync() {
    if (!open) return;
    const text = echoText(deps.machine);
    if (text === shown) return;
    shown = text;
    echo.textContent = text;
  }

  echo.id = 'kbd-echo';
  panel.appendChild(echo);
  buildRows(k, panel);
  if (coarse()) document.body.classList.add('coarse');
  pill.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    deps.wake();
    setOpen(!open);
  });
  setOpen(coarse() && read());

  return {
    open: () => (open ? undefined : setOpen(true)),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    isOpen: () => open,
    sync,
  };
}
