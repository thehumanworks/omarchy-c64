/**
 * `10 PRINT CHR$(205.5+RND(1)); : 20 GOTO 10` — the one-liner maze, still
 * running forever. Writes straight into the buffer. May import `src/text/`.
 */

import { CYAN, LTBLUE, LTGREEN, LTGREY, WHITE } from '../text/palette.js';

const INK = [LTBLUE, CYAN, WHITE, LTGREEN];

export function startMaze(buffer, machine, content, snd) {
  machine.page = 'maze';
  machine.maze = { r: 1, c: 0, acc: 0 };
  buffer.overlay = null;
  buffer.clearRows(1, buffer.rows - 2);
  buffer.cursor = null;
  buffer.at(0, buffer.rows - 2, content.strings.maze.footer.slice(0, buffer.cols), LTGREY);
  snd.noise(0.1, 0.04, 1400, 2);
}

export function stepMaze(buffer, machine, dt) {
  const m = machine.maze;
  if (!m) return;
  m.acc += dt * 1100;
  while (m.acc > 1) {
    m.acc -= 1;
    buffer.put(m.c, m.r, Math.random() < 0.5 ? 77 : 78, INK[(m.r * 7 + m.c) & 3]);
    m.c++;
    if (m.c >= buffer.cols) {
      m.c = 0;
      m.r++;
      if (m.r > buffer.rows - 4) {
        m.r = buffer.rows - 4;
        buffer.scrollUp(1, buffer.rows - 4);
      }
    }
  }
}
