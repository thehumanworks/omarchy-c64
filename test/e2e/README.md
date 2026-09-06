# End-to-end tests

Playwright boots the **built** page in headless Chromium and checks it the way a
visitor would see it. Nothing here reads `src/`: the subject is `dist/index.html`.

## Running

```sh
npm run build            # or: node build.mjs dist/index.html
npm run test:e2e         # run every suite
npm run test:e2e:ui      # the interactive runner
npm run test:e2e:update  # re-record the golden screenshots
```

The page is self-contained — three.js, the character ROM and every texture are
inlined — so the tests open it over `file://` and no dev server is started. That
also means they do not care _how_ `dist/index.html` was produced.

Report: `playwright-report/` (`--reporter=html`, never auto-opened).

## Suites

| file                 | what it proves                                                  |
| -------------------- | --------------------------------------------------------------- |
| `boot.spec.js`       | WebGL starts, no errors, loader gone, `.sr` fallback nav intact |
| `fallback.spec.js`   | with WebGL denied the body fails over to the 14 plain links     |
| `visual.spec.js`     | golden screenshots at desktop / phone / ultrawide               |
| `menu.spec.js`       | the tube's text: menu, docs, `HELP`, `POKE`, `SYS 64738`        |
| `pointer.spec.js`    | hardware hover labels, clicking a menu row, third-party new tab |
| `responsive.spec.js` | the grid reflows: narrow+tall on a phone, 40 columns when wide  |

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

It is part of the product (`src/runtime/test-hook.js`), not test-only scaffolding
bolted on from outside. The suites that depend on it call `hasHook(page)` and
`test.skip(...)`, so they report as **skipped**, not failed, on a build that
predates it. `boot`, `fallback` and `visual` never touch it.

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
  60 s. Never assert on how long the boot animation takes; press a key (or call
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
