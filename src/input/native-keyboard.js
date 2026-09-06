/** Native editing owns text/selection/composition; the machine owns commands. */
export function createNativeKeyboard({ input, keys, machine, wake, viewport }) {
  let composing = false;
  function sync() {
    if (composing || input.value === machine.input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = machine.input;
    input.setSelectionRange(start, end);
  }
  function edit() {
    if (composing) return;
    wake();
    keys.setInput(input.value);
    sync();
  }
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    edit();
  });
  input.addEventListener('input', edit);
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || composing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    wake();
    keys.press(e.key);
    sync();
    if (e.key === 'Enter' || e.key === 'Escape') input.blur();
  });
  input.addEventListener('focus', () => {
    wake();
    viewport.focus();
    sync();
  });
  input.addEventListener('blur', () => viewport.blur());
  return {
    open() {
      // Called synchronously from a tube tap: iOS requires user activation.
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    },
    sync,
  };
}
