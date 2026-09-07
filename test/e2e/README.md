# End-to-end tests

Playwright boots the **built** page in headless Chromium and checks it the way a
visitor would see it. The subject is `dist/index.html`; content-driven suites
import pure content/text modules from `src/` to derive expected tube text.

## Running

```sh
npm run build            # refresh dist/index.html before testing
npm run test:e2e         # run every suite
npm run test:e2e:ui      # the interactive runner
npm run test:e2e:update  # re-record the golden screenshots
```

The page is self-contained — three.js, the character ROM and every texture are
inlined — so the tests open it over `file://` and no dev server is started. That
also means they do not care _how_ `dist/index.html` was produced.

Report: `playwright-report/` (`--reporter=html`, never auto-opened).

## Suites

| file                       | what it proves                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `boot.spec.js`             | WebGL starts, no errors, loader gone, no floating badge, `.sr` fallback nav intact                |
| `fallback.spec.js`         | with WebGL denied the body fails over to the 14 plain links                                       |
| `visual.spec.js`           | golden screenshots at desktop / phone / ultrawide                                                 |
| `menu.spec.js`             | the tube's text: menu, docs, `HELP`, `POKE`, `SYS 64738`                                          |
| `pointer.spec.js`          | hardware hover labels, clicking a menu row, third-party new tab                                   |
| `responsive.spec.js`       | the grid reflows: narrow+tall on a phone, 40 columns when wide                                    |
| `content.spec.js`          | every first-party page opens, shows its title and first heading, scrolls, links are hittable      |
| `navigation.spec.js`       | Tab cycling, names and prefixes, HELP/ABOUT/LIST/DIR, shortcuts, power switch, knob drag          |
| `layout.spec.js`           | six viewports: grid bounds, rows fit, menu box intact; iPad goldens                               |
| `touch.spec.js`            | no editable field or badges, stable touch geometry, link taps and swipe/wheel scroll              |
| `monitor-controls.spec.js` | bezel rocker and Enter: navigation, repeat/cancel, no press effect while held, boot, hit targets  |
| `cursor.spec.js`           | the retro pointer: shows over the canvas, hand over links, hides on mouse leave, persistent touch |

`orientation.spec.js` also verifies sequential orientation/viewport changes
and projected control alignment after dimensions settle.

## Verification and runtime

`npm run test:e2e` always runs fresh and records a complete passing result for
local pre-push reuse. Filtered/UI/snapshot-update runs invalidate that result.
[CI](../../docs/CI.md) documents the fingerprint and four-runner sharding; a
single shard never counts as full proof.

Keyboard/content assertions use `{ settle: false }` when only machine state
or buffer text matters. `skipBoot` still waits for app mode and boot itself
repaints synchronously. Visual and geometric pointer checks retain the four-second
camera/CRT warm-up. Typed commands still use real key events, without a synthetic
per-character delay. Test assertions, golden tolerances and timeouts are unchanged.

## The test hook

Everything on the tube is drawn into a WebGL texture, so there is no DOM to
query. The app therefore exposes a small, deliberate contract:

```js
window.__omarchy = {
  screenText(), // array of row strings — the character buffer, read back
  state(),      // { mode, page, sel, input, powered, cols, rows, status, doc? }
  skipBoot(),   // jump straight to the main menu
};
```

It is part of the product (`src/runtime/test-hook.js`). Suites that use it
assert that it exists; a missing hook fails verification. Do not restore legacy
skips for builds that predate the hook. `boot`, `fallback` and `visual` test
startup or appearance independently. See [Debugging](../../docs/DEBUGGING.md)
for readback examples and trace capture.

## Why SwiftShader

There is no GPU in CI or in a headless run, so Chromium is launched with:

```
--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist
```

ANGLE is pointed at the software rasteriser; without `--enable-unsafe-swiftshader`
Chromium refuses to hand a WebGL context to the page, and `--ignore-gpu-blocklist`
stops it bailing out on the virtual adapter.

Consequences the tests are written around:

- **It is slow** (~10 fps). Workers are pinned to 1 and the per-test timeout is
  120 s (see `playwright.config.js`). Never assert on how long the boot animation takes; press a key (or call
  `skipBoot()`) and poll for the state you want.
- **It is not pixel-exact**, and the CRT shader paints animated film grain on top.
  Screenshot comparison runs with `maxDiffPixelRatio: 0.05` and `threshold: 0.3`.

## Goldens

`test/e2e/__screenshots__/…` — committed, and shared between macOS and Linux CI:
`snapshotPathTemplate` deliberately leaves the platform out of the path. Update
them with `npm run test:e2e:update` and **look at the diff** before committing;
the tolerance is wide enough that a real regression can still look plausible.

`helpers/shots.mjs` shoots the same three viewports outside the test runner when
you just want to eyeball a change:

```sh
node test/e2e/helpers/shots.mjs dist/index.html /tmp/shots
```

## Pointer artwork

For retro pointer artwork, edit the arrow/hand pixel rows in
`src/input/cursor.js`: `X` is fill, `o` outline, `.` transparent. Keep rows the
same width. Build, run `npm run test:e2e -- test/e2e/cursor.spec.js`, and inspect
`test/e2e/__screenshots__/cursor.spec.js/desktop-cursor.png`. Add
`--update-snapshots` only when the requested design change warrants new goldens.

## Mobile hardware verification

Touch uses the photographed rocker and Enter button, with no native/custom
keyboard or HTML input field. `monitor-controls.spec.js` covers selection,
scrolling, Enter, holding/cancelling, boot and landscape/iPad target alignment.
`touch.spec.js` proves there are no floating badges, that physical command text
stays on the CRT, and that taps leave the layout stable. `phone-no-badges` is
the regression golden for the former floating HELP input field.

On an iPhone/iPad, use the rocker to select/scroll and Enter to open the entry
or return to the menu. Holding repeats; lifting or cancelling stops it. Taps
and document swipes must never raise a keyboard or floating badge. The cursor
stays visible after release and follows the next touch.
