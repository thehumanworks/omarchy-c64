/**
 * The BASIC prompt: a table of `[matcher, handler]` rows walked top to bottom.
 * `ctx` carries the injected side effects — `{ buffer, machine, content, snd,
 * coldStart, startMaze, launch, openLink }` — so the whole interpreter runs in
 * plain Node with no DOM. May import `src/text/` and the pure page builders.
 */

import { LTGREEN, LTRED } from '../text/palette.js';
import { say } from './state.js';
import { helpLines } from './help.js';
import { dirLines } from './dir.js';
import { renderTextPage } from './text-page.js';

const strings = (ctx) => ctx.content.strings;

const show = (ctx, page, lines, title) => {
  ctx.machine.page = page;
  renderTextPage(ctx.buffer, lines, title);
};

function poke(ctx, m) {
  const v = parseInt(m[2], 10) & 15;
  if (m[1] === '53280') ctx.buffer.border = v;
  else ctx.buffer.bg = v;
  say(ctx.machine, ctx.content.strings.status.ok, LTGREEN);
  ctx.snd.beep(950, 0.04);
}

/** A menu entry by number, 1..14. */
const byNumber = (cmd, ctx) => {
  const n = parseInt(cmd, 10);
  return String(n) === cmd && n >= 1 && n <= ctx.content.menu.length ? [cmd, n] : null;
};

/** An exact menu label, or a prefix of three characters or more. */
const byName = (cmd, ctx) => {
  const i = ctx.content.menu.findIndex(
    (e) => e.label === cmd || (cmd.length >= 3 && e.label.startsWith(cmd)),
  );
  return i >= 0 ? [cmd, i] : null;
};

const byShortcut = (cmd, ctx) => (ctx.content.shortcuts[cmd] ? [cmd] : null);

/** Say something rude and, optionally, buzz. `beep` is a full `Snd.beep` call. */
const grumble = (key, beep) => (ctx) => {
  say(ctx.machine, strings(ctx).status[key], LTRED);
  if (beep) ctx.snd.beep(...beep);
};

const COMMANDS = [
  [/^POKE ?(53280|53281) ?, ?(\d+)$/, poke],
  [/^SYS ?64738$/, (ctx) => ctx.coldStart()],
  [/^(10 ?PRINT|MAZE)/, (ctx) => ctx.startMaze()],
  [
    ['HELP', '?'],
    (ctx) =>
      show(ctx, 'help', helpLines(ctx.buffer.cols - 6, ctx.content), strings(ctx).help.title),
  ],
  [
    ['ABOUT', 'INFO', 'NEOFETCH', 'FASTFETCH'],
    (ctx) => show(ctx, 'about', strings(ctx).about.lines, strings(ctx).about.title),
  ],
  [['LIST'], (ctx) => show(ctx, 'list', strings(ctx).list.lines, strings(ctx).list.title)],
  [
    ['DIR', 'CATALOG', 'LS', /^LOAD ?"\$"/],
    (ctx) => {
      show(ctx, 'dir', dirLines(ctx.content), strings(ctx).dir.title);
      ctx.snd.noise(0.35, 0.05, 480, 2);
    },
  ],
  [
    ['RUN', 'MENU', 'HOME', 'CLR', 'CLS'],
    (ctx) => {
      ctx.machine.page = 'menu';
    },
  ],
  [['SUDO', 'SUDO SU', 'ROOT'], grumble('permission', [170, 0.18, 'square', 0.11, -60])],
  [['VIM', ':Q', ':Q!', 'EXIT'], grumble('cannotExit')],
  [['SYSTEMD'], grumble('notFound')],
  [
    byNumber,
    (ctx, m) => {
      ctx.machine.sel = m[1] - 1;
      ctx.launch(m[1] - 1);
    },
  ],
  [
    byName,
    (ctx, m) => {
      ctx.machine.sel = m[1];
      ctx.machine.page = 'menu';
      ctx.launch(m[1]);
    },
  ],
  [byShortcut, (ctx, m) => ctx.openLink(ctx.content.shortcuts[m[0]], m[0])],
];

function match(matcher, cmd, ctx) {
  if (typeof matcher === 'function') return matcher(cmd, ctx);
  if (matcher instanceof RegExp) return cmd.match(matcher);
  for (const m of matcher) {
    if (m instanceof RegExp ? m.test(cmd) : m === cmd) return [cmd];
  }
  return null;
}

/** Run one line typed at the READY prompt. */
export function exec(raw, ctx) {
  const cmd = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  ctx.machine.status = '';
  if (!cmd) {
    ctx.machine.page = 'menu';
    return;
  }
  for (const [matcher, handler] of COMMANDS) {
    const m = match(matcher, cmd, ctx);
    if (m) {
      handler(ctx, m);
      return;
    }
  }
  say(ctx.machine, strings(ctx).status.syntax, LTRED);
  ctx.snd.beep(180, 0.15, 'square', 0.1, -60);
}
