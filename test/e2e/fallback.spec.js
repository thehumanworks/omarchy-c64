// No WebGL, no Commodore: the module script throws, body gets `failed`, and the
// plain-links panel takes over. Simulated by making getContext refuse webgl.
/* Callbacks in page.evaluate/addInitScript run in the browser, not in Node. */
import { expect, test } from '@playwright/test';
import { DIST_URL } from './helpers/page.js';

/** Deny webgl/webgl2 contexts but leave 2d alone (the painter uses a 2d canvas). */
async function breakWebGL(page) {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
      if (typeof type === 'string' && /^(webgl2?|experimental-webgl)$/i.test(type)) return null;
      return real.call(this, type, ...rest);
    };
  });
}

test.describe('without WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await breakWebGL(page);
    await page.goto(DIST_URL);
    await page.waitForFunction(() => document.body.classList.contains('failed'), null, {
      timeout: 30_000,
    });
  });

  test('the body is marked failed and the fallback panel is shown', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/\bfailed\b/);
    await expect(page.locator('body')).not.toHaveClass(/\bready\b/);
    await expect(page.locator('#fallback')).toBeVisible();
    await expect(page.locator('#loader')).toBeHidden();
  });

  test('the fallback offers 14 links, all with real hrefs', async ({ page }) => {
    const links = page.locator('#fallback nav a');
    await expect(links).toHaveCount(14);
    const hrefs = await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(hrefs).toHaveLength(14);
    for (const href of hrefs) expect(href).toMatch(/\S/);
    const texts = await links.evaluateAll((els) => els.map((a) => a.textContent.trim()));
    for (const text of texts) expect(text).toMatch(/\S/);
  });
});
