/**
 * One frame of the tube: the frame bar, whichever page owns the middle, then
 * the prompt and the ticker. The static pages (HELP, ABOUT, LIST, DIR) draw
 * themselves once and are simply left alone here.
 * May import `src/text/`, `src/screen/` and its sibling renderers.
 */

import { drawFrame, drawPrompt, drawTicker } from './chrome.js';
import { renderMenu } from './menu.js';
import { renderDoc } from './doc.js';

export function repaint(buffer, machine, content) {
  drawFrame(buffer, machine, content);
  if (machine.page === 'menu') renderMenu(buffer, machine, content);
  else if (machine.page === 'doc') renderDoc(buffer, machine, content);
  drawPrompt(buffer, machine, content);
  drawTicker(buffer, machine, content);
}
