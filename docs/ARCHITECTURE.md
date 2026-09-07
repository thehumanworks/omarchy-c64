# Architecture

The site is plain HTML, CSS and ES modules. `build/build.mjs` bundles the
application, vendored three.js, styles and assets into `dist/index.html`.
There is no server or runtime content fetch. The file works from `file://`.
Read this map before editing `src/`; [AGENTS.md](../AGENTS.md) is the workflow
entry point, and [Debugging](DEBUGGING.md) maps symptoms to focused tests.

## Contracts

- **Composition:** `src/main.js` creates shared objects once and injects
  callbacks across layers. No module imports it or reaches back to its caller.
- **Dependencies:** imports may stay within a layer or go down this order:
  `runtime → input → scene → machine → screen → audio → text → content`.
  `eslint.config.js` enforces the direction and rejects cycles. A new module
  belongs in the layer owning its responsibility, not wherever imports are easiest.
- **Core:** `text/`, `content/`, `machine/`, `screen/text-buffer.js` and
  `scene/case.js` have no DOM or WebGL dependency. Browser effects enter through
  callbacks. Lint checks their boundaries; the unit suite imports every core
  module in plain Node. `audio/sid.js` and `screen/logo.js` also import safely
  in Node, but their explicit initialization/drawing calls use browser APIs.
- **Content:** tube copy lives in `content/*.json` and `content/pages/*.json`.
  Only `src/content/index.js` loads it; consumers receive normalized `content`.
  Site metadata, accessible fallback copy and control labels remain in
  `site/index.html`; keep its duplicated links consistent when editing URLs.
- **Cohesion:** split when responsibilities or reasons to change differ. Keep
  related logic together and interfaces explicit. Lint retains complexity,
  nesting and parameter checks; there are no mechanical line-count limits.
- **Presentation:** preserve monitor artwork, CRT constants, boot timing,
  palette, controls and copy unless explicitly changing them. Rendering changes
  need screenshots inspected by eye, not just passing assertions.

## Find the owner

All application paths below are relative to `src/`. Read the owner first and
follow only the imports or injected callbacks involved in the change.

| Responsibility                             | Owner and interface                                                                                                     | Closest proof                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Startup and wiring                         | `main.js`: screen → scene → machine → layout → input → loop                                                             | e2e boot, fallback                    |
| Load page snapshots                        | `content/index.js`: `{ menu, shortcuts, strings, pages }`; static `PAGE_FILES` registry                                 | unit machine/content                  |
| Character encoding, colors, wrapping, grid | `text/petscii.js`, `palette.js`, `wrap.js`, `grid.js`                                                                   | unit text                             |
| Character memory                           | `screen/text-buffer.js`: `TextBuffer` owns cols/rows, chars/colors, cursor and drawing registers                        | unit screen                           |
| Canvas text and wordmark                   | `screen/painter.js`: `Painter(buffer, rom)`; `screen/logo.js`: `makeLogo(px)`                                           | e2e visual, layout                    |
| UI state and flash messages                | `machine/state.js`: `createMachine()`, `say(machine, text, color)`                                                      | unit machine                          |
| Page repaint                               | `machine/repaint.js` dispatches `menu.js` / `doc.js`; `chrome.js` draws shared frame, prompt, ticker                    | unit menu, e2e content                |
| Document layout                            | `machine/doc-lines.js`: page nodes → wrapped lines; `doc.js`: visible rows and hit boxes                                | unit doc-lines, e2e content           |
| Typed commands                             | `machine/commands.js`: `exec(cmd, ctx)` matcher/handler table; `help.js`, `dir.js`, `text-page.js`                      | unit commands/help, e2e navigation    |
| Route a selection or link                  | `machine/navigate.js`: `createNavigator({ buffer, machine, content, snd, repaint, links })`                             | unit navigate, e2e pointer/navigation |
| Browser link effects                       | `runtime/links.js`: `browserLinks.newTab(url)` and `.mailto(url)`, injected into navigator by main                      | e2e navigation/pointer                |
| Boot, power, maze                          | `machine/boot.js`, `power.js`, `maze.js`: state transitions and step functions                                          | e2e menu/navigation/monitor-controls  |
| Sound                                      | `audio/sid.js`: `Snd`; calls no-op until `init()` creates the audio graph                                               | Node import, browser interaction      |
| Renderer and photographed case             | `scene/renderer.js`, `hardware.js`, `textures.js`; `case.js` is pure nine-slice maths, `case-geometry.js` builds meshes | unit case, e2e visual                 |
| CRT and post-processing                    | `scene/crt.js`: uniforms/persistence; `post.js`: bloom/final grade; `room.js`: wall; `shaders/*.js`: GLSL strings       | unit crt, e2e visual                  |
| Responsive geometry                        | `scene/layout.js`: `{ layout, view }`; `control-bounds.js`: bezel projection                                            | unit layout, e2e orientation/layout   |
| Physical keyboard                          | `input/keyboard.js`: `createKeyboard(deps)` returns `{ press }`, shared with touch hardware                             | e2e navigation/monitor-controls       |
| Pointer and document scroll                | `input/pointer.js`, `pick.js`, `scroll.js`; pointer returns `{ mouse, cellAt, attach }` to wire scrolling               | e2e pointer/touch                     |
| Bezel rocker and Enter                     | `input/monitor-controls.js`: `createMonitorControls({ root, keys, wake, bounds })` returns `{ sync }`                   | e2e monitor-controls/touch            |
| Retro pointer and hover metadata           | `input/cursor.js`: pixel sprites; `hint.js`: `canvas.dataset.hint`, no visible badge                                    | e2e cursor/pointer                    |
| Frame clock and presentation               | `runtime/loop.js`: `createLoop(deps).start()`; `favicon.js`: tab icon                                                   | e2e boot/visual/orientation           |
| Diagnostic readback                        | `runtime/test-hook.js`: `installTestHook({ buffer, machine, boot })` exposes `window.__omarchy`                         | e2e hook assertions                   |

## Data and state flow

```text
committed JSON → normalized content → machine state → TextBuffer
                                                       ↓
input events → injected command/navigation callbacks   Painter canvas
                                                       ↓
                                      CRT persistence → post-processing → screen
```

`TextBuffer` owns grid size; do not introduce a second cols/rows authority.
`machine` owns mode, selected page, selection, input, scroll and clickable hits.
Page renderers receive `(buffer, machine, content)` and write the buffer and
render-derived state such as hit boxes. They do not own DOM elements.

`exec` receives `{ buffer, machine, content, snd, coldStart, startMaze, launch,
openLink }`. Navigation decides whether a menu entry has a bundled document;
it does not treat every omarchy.org URL as local. The `links` interface handles
browser effects only; routing remains unit-testable without a DOM. Existing
command-link and followed-mail behavior is preserved in `navigate.test.js`.

## Adding a command

For a new typed command, add a matcher/handler in `machine/commands.js`, its
help text in `content/strings.json`, and a case in
`test/unit/machine/commands.test.js`. Side effects use `ctx`; do not add DOM
access to the interpreter. The command table is ordered: check precedence
against existing names and prefixes.

## Frame and resize order

Each frame checks CSS dimensions and capped DPR before stepping the machine.
A changed tuple resizes renderer/post targets, camera, case and text grid;
zero-sized canvases defer layout. Document reflow resets its scroll offset.
A grid change recreates the painter's GPU texture because uploaded texture
dimensions are immutable. The loop paints the tube, accumulates phosphor,
samples its glow, moves the camera, renders post-processing, then syncs bezel
hit targets through the updated camera. Do not replace this with resize-event
ordering assumptions. [Mobile controls](MOBILE-CONTROLS.md) owns artwork and
projection details.

## Build and maintenance tools

`build/build.mjs` bundles `src/main.js` with esbuild, base64-encodes `assets/`
into `window.__OM_RES__`, and replaces the `APP`, `RES` and `CSS` markers in
`site/index.html`. Missing markers fail the build. Build tests create their own
temporary bundle; e2e tests use `dist/index.html` from `npm run build`.
`npm run dev` watches `src/`, `content/`, `site/`, `assets/` on port 8000.

`scripts/ci/` owns conservative affected-check planning; see [CI](CI.md).
`scripts/sync-content.mjs`, `scripts/sync/` and `content/sources.json` are an
optional manual importer, independent of build/runtime/CI. Its stable output
is the page tuple schema in [Content](CONTENT.md); its historical upstream
assumptions are in [Content sources](CONTENT-SOURCES.md).
