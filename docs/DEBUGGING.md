# Debugging

Start with a concrete reproduction: command or gesture, expected/actual result,
viewport, pointer type, browser, and revision. Check `git status --short` before
changing anything. Keep the failure evidence and unrelated local work intact.

## Narrow the layer

| Symptom                                       | Read first                                                                  | Focused check from the repository root                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Page fails to boot or shows plain links       | `site/index.html`, `src/main.js`, `src/scene/renderer.js`                   | `npm run build && npx playwright test test/e2e/boot.spec.js test/e2e/fallback.spec.js`                              |
| Wrong characters, wrap or grid                | `src/text/`, `src/screen/text-buffer.js`                                    | `node --test 'test/unit/text/*.test.js' 'test/unit/screen/*.test.js'`                                               |
| Missing/new page, malformed copy              | `src/content/index.js`, affected `content/pages/*.json`                     | `node --test test/unit/machine/content.test.js test/unit/machine/doc-lines.test.js`                                 |
| Command or link opens wrong destination       | `src/machine/commands.js`, `navigate.js`, `src/runtime/links.js`            | `node --test test/unit/machine/commands.test.js test/unit/machine/navigate.test.js`                                 |
| Click/scroll disagrees with the tube          | `src/input/pointer.js`, `pick.js`, `scroll.js`, `src/machine/doc.js`        | `npm run build && npx playwright test test/e2e/pointer.spec.js test/e2e/touch.spec.js`                              |
| Rocker repeats after release or targets drift | `src/input/monitor-controls.js`, `src/scene/control-bounds.js`, `layout.js` | `npm run build && npx playwright test test/e2e/monitor-controls.spec.js test/e2e/orientation.spec.js`               |
| CRT, case, resize or shader regression        | `src/scene/layout.js`, affected scene/shader file, `src/runtime/loop.js`    | `npm run build && npx playwright test test/e2e/visual.spec.js test/e2e/layout.spec.js test/e2e/orientation.spec.js` |
| Wrong checks selected                         | `scripts/ci/select.mjs`, `plan.mjs`, `checks.mjs`                           | `node --test 'test/unit/ci/*.test.js'` then `npm run ci:plan -- --base origin/main`                                 |
| Optional importer drops text or fails         | `content/sources.json`, affected adapter, `scripts/sync/run.mjs`            | `node --test 'test/unit/sync/*.test.js'`; see [Content sources](CONTENT-SOURCES.md) before a live import            |

## Observe before changing

1. Run the smallest check that reproduces the symptom against the current
   code. E2E reads `dist/index.html`, so rebuild after every source change.
2. Read the first exception and its caller, not only the final timeout. Browser
   helpers collect page/console errors; `body.failed` means startup's catch path
   ran. A missing `window.__omarchy` is a failure, never a reason to skip tests.
3. Inspect the diagnostic hook in the browser console or `page.evaluate`:

   ```js
   window.__omarchy.state(); // mode, page, input, powered, grid, doc offset, hit count
   window.__omarchy.screenText(); // actual character-buffer rows
   window.__omarchy.skipBoot(); // bypass boot for interaction diagnosis
   ```

   Correct buffer text with a wrong picture points toward painter/scene/layout.
   Wrong buffer text points toward content, state, commands or page rendering.
   Correct text with wrong clicks points toward hit boxes and projection.

4. Follow one state transition through the injected callbacks in `main.js`.
   Keep timing, palette and shaders unchanged unless evidence implicates them.
   Do not assume mobile resize events arrive in order; layout checks each frame.
5. Capture a regression at the lowest layer that can demonstrate it. For a
   behavior fix, confirm the test fails before the fix and passes afterward
   using a scratch copy or in-memory fixture; do not reset unrelated work.
6. Run the related browser suites when wiring or interaction changes, then the
   full `npm run check`. Review the final diff and report proof and gaps.

## Browser evidence

Failures retain traces/context and actual/expected/diff images when produced
by Playwright in `test-results/`; the HTML report is in `playwright-report/`.
CI uploads those directories on failure. Open the report with:

```sh
npx playwright show-report
```

The configuration does not enable trace recording by default. To capture a
focused failure with actions, DOM snapshots and console messages:

```sh
npm run build
npx playwright test test/e2e/navigation.spec.js --trace on
npx playwright show-trace test-results/PATH-FROM-THE-RUN/trace.zip
```

For a visual inspection independent of assertion success:

```sh
node test/e2e/helpers/shots.mjs dist/index.html /tmp/omarchy-shots
```

Open the actual PNGs. SwiftShader is slow and shaders animate; poll state rather
than using new fixed sleeps, and investigate the diff before changing timeout
or screenshot tolerance. Use [Mobile controls](MOBILE-CONTROLS.md) for device
checks and [Development](DEVELOPMENT.md) for the final evidence standard.
