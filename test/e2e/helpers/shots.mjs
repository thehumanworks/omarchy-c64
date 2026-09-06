// usage (from the project dir so @playwright/test resolves):
//   node <this file> <path/to/index.html> <outdir>
// Boots the page headless (SwiftShader WebGL), skips the boot animation with a
// keypress (the site does that on any key), lets the CRT warm up, screenshots
// three viewports. Prints body class + any page/console errors per viewport.
import { chromium } from '@playwright/test';
import path from 'node:path';

const [, , file, outdir] = process.argv;
const VIEWPORTS = { desktop: [1280, 800], phone: [390, 844], ultrawide: [2560, 800] };
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const [name, [width, height]] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`file://${path.resolve(file)}`);
  await page.waitForFunction(
    () => document.body.classList.contains('ready') || document.body.classList.contains('failed'),
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await page.keyboard.press('Shift'); // skip the boot sequence -> main menu
  await page.waitForTimeout(4000); // let the tube warm up and the intro dolly settle
  await page.screenshot({ path: path.join(outdir, `${name}.png`) });
  console.log(
    name,
    'body:',
    await page.evaluate(() => document.body.className),
    '| errors:',
    errors.length ? errors : 'none',
  );
  await page.close();
}
await browser.close();
