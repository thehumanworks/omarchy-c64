/** Invisible native buttons track the photographed knob and push button. */
function bindEnter(button, press) {
  let pointer = null;
  const stop = () => {
    pointer = null;
  };
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    button.setPointerCapture(pointer);
  });
  button.addEventListener('pointerup', (e) => {
    if (pointer !== e.pointerId) return;
    stop();
    const r = button.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      press('Enter');
  });
  for (const event of ['pointercancel', 'lostpointercapture']) button.addEventListener(event, stop);
  window.addEventListener('blur', stop);
  // WebKit suppresses click after a prevented touch pointerdown. Use pointerup
  // for pointers, and detail=0 clicks only for keyboard/assistive activation.
  button.addEventListener('click', (e) => {
    if (e.detail === 0) press('Enter');
  });
}

export function createMonitorControls({ root, keys, wake, bounds }) {
  const nav = root.querySelector('#monitor-nav');
  const enter = root.querySelector('#monitor-enter');
  let pointer = null;
  let timer = 0;
  let direction = '';
  function stop() {
    clearTimeout(timer);
    pointer = null;
    direction = '';
    nav.removeAttribute('data-direction');
  }
  function press(key) {
    wake();
    keys.press(key);
  }
  function repeat() {
    press(direction);
    timer = setTimeout(repeat, 110);
  }
  function aim(e) {
    const r = nav.getBoundingClientRect();
    const x = e.clientX - r.x - r.width / 2;
    const y = e.clientY - r.y - r.height / 2;
    const key =
      Math.abs(y) >= Math.abs(x)
        ? y < 0
          ? 'ArrowUp'
          : 'ArrowDown'
        : x < 0
          ? 'ArrowLeft'
          : 'ArrowRight';
    if (key === direction) return;
    direction = key;
    nav.dataset.direction = key;
    press(key);
  }
  nav.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stop();
    pointer = e.pointerId;
    nav.setPointerCapture(pointer);
    aim(e);
    timer = setTimeout(repeat, 420);
  });
  nav.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) aim(e);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    nav.addEventListener(event, stop);
  }
  window.addEventListener('blur', stop);
  nav.addEventListener('click', (e) => {
    if (e.detail === 0 && e.target.dataset.key) press(e.target.dataset.key);
  });
  bindEnter(enter, press);
  return {
    sync() {
      const boxes = bounds();
      if (!boxes) return;
      for (const [el, rect] of [
        [nav, boxes.nav],
        [enter, boxes.enter],
      ]) {
        for (const [name, value] of Object.entries(rect)) el.style[name] = `${value}px`;
      }
      root.classList.add('placed');
    },
  };
}
