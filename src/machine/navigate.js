/**
 * Where a click or a typed name actually goes: a first-party page opens on the
 * tube, anything else opens a browser tab. Browser effects are injected by
 * main.js; routing and document layout can run without a DOM.
 */

import { pretty } from '../text/wrap.js';
import { LTGREEN } from '../text/palette.js';
import { say } from './state.js';
import { docLines } from './doc-lines.js';

const fill = (template, value) => template.replace('$1', value);

/**
 * `deps` is `{ buffer, machine, content, snd, repaint, links }`.
 * `links` supplies `newTab(url)` and `mailto(url)` browser effects.
 * Returns the navigation callbacks `commands.js` and `input/` are given.
 */
export function createNavigator(deps) {
  const { buffer, machine, content, snd, repaint, links } = deps;
  const status = () => content.strings.status;

  function openDoc(key) {
    const page = content.pages[key];
    machine.doc = { key, title: page.title, off: 0, lines: docLines(page, buffer.cols - 6) };
    machine.page = 'doc';
    say(machine, fill(status().loading, key), LTGREEN);
    snd.beep(300, 0.06, 'square', 0.09, 520);
    repaint();
  }

  function openLink(url, label) {
    say(machine, fill(status().launching, label), LTGREEN);
    snd.beep(320, 0.08, 'square', 0.11, 640);
    setTimeout(() => snd.beep(780, 0.11, 'square', 0.11, 380), 85);
    links.newTab(url);
  }

  /* Only URLs matching a bundled menu page open on the tube. */
  function follow(url) {
    const trim = (u) => u.replace(/\/+$/, '');
    const entry = content.menu.find((e) => trim(e.url) === trim(url));
    if (entry && content.pages[entry.label]) {
      openDoc(entry.label);
      return;
    }
    if (/^mailto:/i.test(url)) {
      /* a tab for mail is silly */
      say(machine, status().mail, LTGREEN);
      snd.beep(320, 0.08, 'square', 0.11, 640);
      links.mailto(url);
      return;
    }
    openLink(url, (entry ? entry.label : pretty(url)).slice(0, 22));
  }

  /** Launch menu entry `i`: first-party pages stay on the tube. */
  function launch(i) {
    const entry = content.menu[i];
    if (content.pages[entry.label]) openDoc(entry.label);
    else openLink(entry.url, entry.label);
  }

  /** Re-lay the open document after a grid change. */
  function relayoutDoc() {
    if (machine.page !== 'doc' || !machine.doc) return;
    machine.doc.lines = docLines(content.pages[machine.doc.key], buffer.cols - 6);
    machine.doc.off = 0;
  }

  return { openLink, follow, launch, relayoutDoc };
}
