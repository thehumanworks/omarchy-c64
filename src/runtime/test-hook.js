/**
 * `window.__omarchy` — the product's contract with the end-to-end suite.
 * It reads the tube back as text, snapshots the machine, and lets a test skip
 * the eight-second boot. Tiny on purpose. Keep it working.
 * Imports nothing; main.js hands it the objects.
 */

/** `deps` is `{ buffer, machine, boot }`. */
export function installTestHook(deps) {
  const { buffer, machine, boot } = deps;
  window.__omarchy = {
    /** The whole screen, one string per row. */
    screenText: () => buffer.text(),

    /** A snapshot of everything a test needs to assert on. */
    state: () => ({
      mode: machine.mode,
      page: machine.page,
      sel: machine.sel,
      input: machine.input,
      status: machine.status,
      powered: machine.powered,
      cols: buffer.cols,
      rows: buffer.rows,
      border: buffer.border,
      bg: buffer.bg,
      doc: machine.doc ? { key: machine.doc.key, off: machine.doc.off } : null,
      /** How many clickable boxes the page just drew. */
      hits: machine.hits.length,
      /** How many rows the open document has, in total, at this width. */
      docLines: machine.doc ? machine.doc.lines.length : 0,
    }),

    /** Jump straight to the menu. */
    skipBoot: () => boot.skipBoot(),
  };
}
