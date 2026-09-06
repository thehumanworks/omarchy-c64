/**
 * OMARCHY 64 — omarchy.org, rebooted as a Commodore 64.
 *
 * The composition root: it creates every object once, wires the callbacks
 * between the layers, and starts the render loop. Nothing imports this file,
 * and no other module reaches back up to it.
 */

import * as content from './content/index.js';
import { TextBuffer } from './screen/text-buffer.js';
import { Painter } from './screen/painter.js';
import { makeLogo } from './screen/logo.js';
import { Snd } from './audio/sid.js';
import { createMachine } from './machine/state.js';
import { repaint as repaintPage } from './machine/repaint.js';
import { createNavigator } from './machine/navigate.js';
import { createBoot } from './machine/boot.js';
import { createPower } from './machine/power.js';
import { startMaze } from './machine/maze.js';
import { exec } from './machine/commands.js';
import { createRenderer } from './scene/renderer.js';
import { loadTexture } from './scene/textures.js';
import { solveCase } from './scene/case.js';
import { createMonitor, MON } from './scene/hardware.js';
import { createCrt } from './scene/crt.js';
import { createWall } from './scene/room.js';
import { createPost } from './scene/post.js';
import { createLayout } from './scene/layout.js';
import { createHint } from './input/hint.js';
import { createCursor } from './input/cursor.js';
import { createPointer } from './input/pointer.js';
import { createKeyboard } from './input/keyboard.js';
import { createLoop } from './runtime/loop.js';
import { installFavicon } from './runtime/favicon.js';
import { installTestHook } from './runtime/test-hook.js';

const RES = window.__OM_RES__;
const rom = Uint8Array.from(atob(RES.chargen), (c) => c.charCodeAt(0));

/* ---------------------------------------------------------------- screen */
const buffer = new TextBuffer(40, 25);
const painter = new Painter(buffer, rom);
const machine = createMachine();
machine.logo = makeLogo(2);
const repaint = () => repaintPage(buffer, machine, content);

/* --------------------------------------------------------------- 3d scene */
const canvas = document.getElementById('gl');
const { renderer, scene, camera, rig, blit } = createRenderer(canvas);
const texMonitor = await loadTexture(renderer, RES.monitor);

const tube = createCrt(painter);
const { monitor, power: ledPower, powerMat } = createMonitor(solveCase(MON.w, MON.h), texMonitor);
rig.add(tube.screenMesh, tube.tubeBack, monitor, ledPower);

const wall = createWall();
scene.add(wall);
const post = createPost(renderer, blit);

/* ---------------------------------------------------------------- machine */
const nav = createNavigator({ buffer, machine, content, snd: Snd, repaint });
const boot = createBoot({ buffer, machine, content, snd: Snd, repaint, crt: tube.crt });
const togglePower = createPower({ machine, snd: Snd, boot, crt: tube.crt });

const run = (cmd) =>
  exec(cmd, {
    buffer,
    machine,
    content,
    snd: Snd,
    coldStart: () => boot.coldStart(),
    startMaze: () => startMaze(buffer, machine, content, Snd),
    launch: (i) => nav.launch(i),
    openLink: (url, label) => nav.openLink(url, label),
  });

/* ----------------------------------------------------------------- layout */
const { layout, view } = createLayout({
  renderer,
  camera,
  rig,
  tube,
  post,
  monitor,
  ledPower,
  painter,
  buffer,
  machine,
  content,
  repaint,
  relayoutDoc: () => nav.relayoutDoc(),
});
window.addEventListener('resize', layout);

/* ------------------------------------------------------------ interaction */
const setHint = createHint(document.getElementById('hint'));
createCursor({ canvas, el: document.getElementById('cursor') });

function wake() {
  Snd.init();
  if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume();
  document.body.classList.add('interacted');
}

const { mouse } = createPointer({
  canvas,
  camera,
  monitor,
  screenMesh: tube.screenMesh,
  crt: tube.crt,
  buffer,
  painter,
  machine,
  content,
  snd: Snd,
  nav,
  boot,
  run,
  repaint,
  setHint,
  togglePower,
  wake,
});

createKeyboard({ machine, content, snd: Snd, nav, boot, run, wake, togglePower, buffer });

installTestHook({ buffer, machine, boot });

/* ----------------------------------------------------------------- runtime */
layout();
boot.coldStart();

const loaderEl = document.getElementById('loader');
if (loaderEl) loaderEl.remove();
document.body.classList.add('ready');

createLoop({
  scene,
  camera,
  rig,
  blit,
  post,
  tube,
  monitor,
  wall,
  powerMat,
  painter,
  buffer,
  machine,
  content,
  boot,
  repaint,
  view,
  mouse,
}).start();

installFavicon();
