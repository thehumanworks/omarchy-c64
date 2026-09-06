// Touch uses the photographed monitor controls and never opens an HTML overlay.
import { expect, test } from '@playwright/test';
import { openSite, skipBoot, state } from './helpers/page.js';
import { probeHint, tubeRegion } from './helpers/probe.js';

const PHONE = { width: 390, height: 844 };
async function atMenu(page, viewport = PHONE) {
  await openSite(page, { viewport });
  await skipBoot(page);
}
async function tubePoint(page, viewport = PHONE) {
  const hit = await probeHint(page, tubeRegion(viewport), 'OPEN MANUAL');
  expect(hit).not.toBeNull();
  return hit;
}
/** A finger drag over the tube, dispatched through CDP so it is a real touch. */
async function swipe(page, from, dy, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  const at = (y) => [{ x: from.x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(Math.round(from.y + (dy * i) / steps)),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });
  test('HELP stays on the CRT with no badge or input overlay', async ({ page }) => {
    await atMenu(page);
    await page.touchscreen.tap(195, 185);
    await page.keyboard.type('HELP');
    await expect.poll(async () => (await state(page)).input).toBe('HELP');
    await expect
      .poll(() => page.evaluate(() => window.__omarchy.screenText().join('\n')))
      .toContain('HELP');
    await expect(
      page.locator('input, textarea, [contenteditable], #hint, #kbd, #kbd-toggle'),
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot('phone-no-badges.png');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).page).toBe('help');
  });
  test('a swipe scrolls without opening input or following links', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
    await swipe(page, hit, -220);
    await expect.poll(async () => (await state(page)).doc.off).toBeGreaterThan(0);
    const off = (await state(page)).doc.off;
    await expect(page.locator('input, textarea, #hint')).toHaveCount(0);
    await swipe(page, hit, 220);
    await expect.poll(async () => (await state(page)).doc.off).toBeLessThan(off);
    expect((await state(page)).doc.key).toBe('MANUAL');
  });

  test('link taps open the page without summoning a keyboard', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.touchscreen.tap(hit.x, hit.y);
    await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
    await expect(page.locator('input, textarea, #hint')).toHaveCount(0);
  });
});

test.describe('desktop', () => {
  test.use({ hasTouch: false, viewport: { width: 1280, height: 800 } });
  test('the wheel scrolls a document', async ({ page }) => {
    await atMenu(page, { width: 1280, height: 800 });
    const hit = await probeHint(page, tubeRegion({ width: 1280, height: 800 }), 'OPEN MANUAL');
    expect(hit).not.toBeNull();
    await page.keyboard.type('1', { delay: 25 });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).page).toBe('doc');

    await page.mouse.move(hit.x, hit.y);
    await page.mouse.wheel(0, 240);
    await expect.poll(async () => (await state(page)).doc.off).toBeGreaterThan(0);
  });
});

for (const [name, viewport] of Object.entries({
  portrait: PHONE,
  landscape: { width: 844, height: 390 },
  ipad: { width: 820, height: 1180 },
})) {
  test.describe(`overlay-free ${name}`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport });
    test('tube and hardware taps leave the layout stable with no editable field', async ({
      page,
    }) => {
      await atMenu(page, viewport);
      const before = await page.locator('#gl').boundingBox();
      const grid = await state(page);
      await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.22);
      await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.86);
      await page.locator('#monitor-enter').tap();
      expect(await page.locator('#gl').boundingBox()).toEqual(before);
      const after = await state(page);
      expect([after.cols, after.rows]).toEqual([grid.cols, grid.rows]);
      await expect(page.locator('input, textarea, [contenteditable], #hint')).toHaveCount(0);
      await expect(page.locator('#cursor')).toBeVisible();
    });
  });
}
