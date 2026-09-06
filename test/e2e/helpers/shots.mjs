// Screenshot the built page at the three reference viewports, outside Playwright's
// test runner. Handy for eyeballing a change or refreshing a baseline by hand;
// the golden images themselves are managed by `npm run test:e2e:update`.
//
//   usage (run from the project directory so @playwright/test resolves):
//     node test/e2e/helpers/shots.mjs [path/to/index.html] [outdir]
//     defaults: dist/index.html, ./shots
//
// Boots the page headless with SwiftShader WebGL, skips the boot animation with a
// keypress (the site does that on any key), lets the CRT warm up, then shoots each
// viewport. Prints the body class and any page/console errors per viewport.
/* Callbacks in page.evaluate/addInitScript run in the browser, not in Node. */
/* global document */
import path from 'node:path';
import { chromium } from '@playwright/test';

const VIEWPORTS = { desktop: [1280, 800], phone: [390, 844], ultrawide: [2560, 800] };
const GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

const file = path.resolve(process.argv[2] || 'dist/index.html');
const outdir = path.resolve(process.argv[3] || 'shots');

const browser = await chromium.launch({ args: GL_ARGS });
for (const [name, [width, height]] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto(`file://${file}`);
  await page.waitForFunction(
    () => document.body.classList.contains('ready') || document.body.classList.contains('failed'),
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
  await page.keyboard.press('Shift'); // skip the boot sequence -> main menu
  await page.waitForTimeout(4000); // let the tube warm up and the intro dolly settle
  await page.screenshot({ path: path.join(outdir, `${name}.png`) });

  const body = await page.evaluate(() => document.body.className);
  console.log(name, 'body:', body, '| errors:', errors.length ? errors : 'none');
  await page.close();
}
await browser.close();
