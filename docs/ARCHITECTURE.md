# Architecture

omarchy.org rebooted as a Commodore 64: a single HTML page that renders a
Commodore 1702 monitor in WebGL and runs a 40-column "BASIC" UI on its tube.
No framework, no server: plain HTML, CSS and ES modules, bundled by esbuild
into one `dist/index.html` that Cloudflare Pages serves.

This file is the map. Read it before touching `src/`.

## Guiding rules

1. **Small files.** Lint enforces max 300 lines per file and 80 per function.
   Never raise the limits; split the module instead. The point is that an
   agent can read any one file in full without losing the rest of its context.
2. **Content is data, code is code.** Everything editorial (menu entries, page
   copy, ticker, hints, help text) lives in `content/*.json`. Code never
   hard-codes copy. Changing what the site says must not require touching `src/`.
3. **Pure core, thin shell.** Text layout, the character buffer, page
   renderers, the command interpreter and the nine-slice case maths are pure
   modules: importable in plain Node, no DOM or WebGL globals at import time.
   Only `src/main.js`, `src/screen/painter.js`, `src/scene/**`, `src/input/**`
   and `src/runtime/**` may touch `window`, `document` or three.js.
4. **No import cycles** (lint-enforced). `main.js` is the composition root:
   it creates the objects and wires callbacks. Modules do not reach up to
   their callers.
5. **One direction of data.** `content → machine state → text buffer → painter
canvas → CRT shader → post-processing → screen`. Input events mutate machine
   state; the render loop repaints.
6. **Behaviour is verified, not assumed.** Pure modules have unit tests
   (`node:test`); the built page has Playwright tests that boot it in headless
   Chromium with software WebGL and read the tube's text back through
   `window.__omarchy`.

## Repository layout

```
AGENTS.md              how agents work here (CLAUDE.md points at it)
docs/                  ARCHITECTURE (this), DEVELOPMENT, CONTENT, DEPLOYMENT
content/               editorial data (JSON). See docs/CONTENT.md
  menu.json            the 14 main-menu entries
  shortcuts.json       extra typed names → URLs (DHH, HEY, ...)
  strings.json         ticker, hints, taglines, ABOUT/LIST/HELP copy
  pages/<key>.json     one file per first-party page shown on the tube
assets/                binary inputs the build inlines (character ROM, webp)
vendor/                third-party code we do not edit (three.js)
site/                  index.html template + styles.css (DOM chrome only)
src/                   the application (ES modules, see below)
build/                 build.mjs: esbuild bundle + inline into the template
test/unit              node:test suites for pure modules
test/build             invariants on dist/index.html
test/e2e               Playwright suites against dist/index.html
dist/                  build output (git-ignored)
```

## `src/` module map

Each directory is one layer. Arrows show allowed imports (only downward).

```
runtime/   loop.js (the animate tick), favicon.js, test-hook.js
   ↓
input/     pick.js (raycast the case and the tube), pointer.js (knobs, hover,
           click on tube text), keyboard.js, hint.js
   ↓
scene/     renderer.js textures.js case.js case-geometry.js crt.js hardware.js
           room.js post.js layout.js
           shaders/*.js  (each shader is one file exporting a GLSL string)
   ↓
machine/   state.js chrome.js menu.js doc.js doc-lines.js text-page.js
           commands.js help.js dir.js navigate.js maze.js boot.js power.js
           repaint.js
   ↓
screen/    text-buffer.js (pure: the C64 video RAM) painter.js (canvas + atlas) logo.js
   ↓
audio/     sid.js (Web Audio beeps; safe to import in Node, every call no-ops until init)
   ↓
text/      petscii.js (char → screen code) wrap.js (wrap, sentences, pretty) palette.js grid.js
   ↓
content/   index.js loads and normalises content/*.json (uppercase, ASCII quotes)
```

### Key objects

- **`TextBuffer`** (`screen/text-buffer.js`): `cols`, `rows`, `chars`, `colors`,
  cursor, pen/bg/border registers, `overlay` and `rasterBands` hooks. Methods:
  `clear`, `clearRows`, `put`, `at`, `centre`, `scrollUp`, `nl`, `type`,
  `resize(cols, rows)`, `line(r)` / `text()` (read back as strings, for tests).
  Owns the grid size: nothing else stores `COLS`/`ROWS`.
- **`Painter`** (`screen/painter.js`): draws a `TextBuffer` onto a canvas with
  the character ROM atlas. `width`/`height` in pixels derive from the buffer.
- **`machine`** (`machine/state.js`): the UI state (`mode`, `page`, `sel`,
  `input`, `status`, `doc`, `hits`, `powered`, ...). Plain object, one instance.
- **Page renderers** (`machine/menu.js`, `doc.js`, `text-page.js`, `chrome.js`)
  take `(buffer, machine, content)` and only write into the buffer.
- **`exec(cmd, ctx)`** (`machine/commands.js`): a table of `[matcher, handler]`
  rows walked top to bottom. A matcher is a `RegExp`, a list of strings and
  regexes, or a function. `ctx` carries the injected side effects —
  `{ buffer, machine, content, snd, coldStart, startMaze, launch, openLink }` —
  so the interpreter runs in plain Node with no DOM. (`launch` stands in for
  the planned `openDoc`: whether a menu entry opens on the tube or in a tab is
  `navigate.js`'s decision, not the interpreter's. `say` is imported from
  `machine/state.js` rather than injected, because it only writes state.)
- **Case nine-slice**: `scene/case.js` is the pure maths (`solveBands`,
  `solveCase`, `bandAt`, `mapX`, `mapY`) and is unit-tested; the three.js
  builder `buildCaseGeometry` lives next door in `scene/case-geometry.js` so
  `case.js` stays importable in Node.
- **Test hook** (`runtime/test-hook.js`): installs `window.__omarchy` with
  `screenText()` → array of row strings, `state()` → `{ mode, page, sel, input,
status, powered, cols, rows, border, bg, doc: { key, off } | null }`, and
  `skipBoot()`. It is tiny and it is part of the product's contract with the
  e2e suite. Keep it working.

## Build

`npm run build` runs `build/build.mjs`:

1. esbuild bundles `src/main.js` (format `esm`, minified, three.js included
   from `vendor/`).
2. Assets in `assets/` are base64-encoded into `window.__OM_RES__`.
3. Both are inlined into `site/index.html` at the `APP` and `RES` markers;
   `site/styles.css` goes in at the `CSS` marker inside `<style>`. A missing
   marker fails the build.
4. Output: `dist/index.html`, a single self-contained file (~0.65 MB).

`npm run dev` adds `--watch --serve`: it rebuilds on any change under `src/`,
`content/`, `site/` or `assets/` and serves `dist/` on port 8000.

There is deliberately no runtime code loading, so the page works from `file://`.

## Removed on purpose

The original desk scene (keyboard, disk drive, floppy, oak desk, canvas print,
studio monitor) is not drawn any more: the framing is the monitor alone. The
code and textures were deleted rather than left invisible. If the desk ever
comes back, start from the history of `res/keyboard.webp`.

Gone with it: `seat()` and the `CONTACTS` contact-shadow list, the `SOLO` flag,
the drive/floppy/keyboard LEDs and their hint labels, `loadIso()` and its
timer, and the unused zoom controls (`view.zoom`, `view.targetZoom` and
`view.userZ` were always 0, so the camera maths is now written out flat). The
wall survives: it is one untextured quad and it is what the tube glows onto.
Its shader still carries a literal `-0.370` where `DESK_Y` used to be, because
the contact shading at the foot of the wall reads from it.

## Deviations from the original plan

Both minimal, both deliberate:

- `eslint.config.js` sets `ecmaVersion: 'latest'` rather than `2024`, because
  the content layer needs import attributes (`with { type: 'json' }`), which
  Node requires for JSON modules. No rule was relaxed.
- `vendor/` is no longer ignored: three.js is committed there so a clone builds
  with no network step. See `vendor/README.md` for the version and the upgrade
  recipe. Lint and Prettier still skip the directory.
