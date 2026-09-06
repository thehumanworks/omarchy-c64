import { expect, test } from '@playwright/test';
import { openSite, skipBoot, state } from './helpers/page.js';

const PHONE = { width: 390, height: 844 };
async function atMenu(page) {
  await openSite(page, { viewport: PHONE });
  await skipBoot(page);
  await expect(page.locator('#monitor-enter')).toBeVisible();
}
async function point(page, down) {
  const r = await page.locator('#monitor-nav').boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height * (down ? 0.8 : 0.2) };
}
async function tapDirection(page, down) {
  const p = await point(page, down);
  await page.touchscreen.tap(p.x, p.y);
}

test.describe('mobile monitor hardware', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

  test('rocker selects and scrolls; Enter opens and returns without a keyboard', async ({
    page,
  }) => {
    await atMenu(page);
    await tapDirection(page, true);
    expect((await state(page)).sel).toBe(1);
    await tapDirection(page, false);
    expect((await state(page)).sel).toBe(0);
    await page.locator('#monitor-enter').tap();
    await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
    await tapDirection(page, true);
    await expect.poll(async () => (await state(page)).doc.off).toBeGreaterThan(0);
    await page.locator('#monitor-enter').tap();
    await expect.poll(async () => (await state(page)).page).toBe('menu');
    await page.touchscreen.tap(195, 185);
    await expect(page.locator('input, textarea, #hint')).toHaveCount(0);
    await expect(page.locator('#hint')).toHaveCount(0);
    await expect(page.locator('#kbd, #kbd-toggle')).toHaveCount(0);
    const nav = await page.locator('#monitor-nav').boundingBox();
    const enter = await page.locator('#monitor-enter').boundingBox();
    for (const box of [nav, enter]) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);
    }
    expect(nav.x + nav.width).toBeLessThanOrEqual(enter.x);
    await expect(page).toHaveScreenshot('phone-monitor-controls.png');
  });

  test('Enter can skip boot before the first menu repaint', async ({ page }) => {
    await openSite(page, { viewport: PHONE });
    await page.locator('#monitor-enter').tap();
    await expect.poll(async () => (await state(page)).mode).toBe('app');
    await expect(page.locator('input, textarea, #hint')).toHaveCount(0);
  });

  test('monitor surfaces suppress selection and iOS touch callouts', async ({ page }) => {
    await atMenu(page);
    const surfaces = await page
      .locator('#gl, #cursor, #monitor-controls, #monitor-controls *')
      .evaluateAll((elements) =>
        elements.map((el) => ({
          id: el.id || el.getAttribute('aria-label'),
          selection: getComputedStyle(el).userSelect,
          supportsCallout: CSS.supports('-webkit-touch-callout', 'none'),
          callout: getComputedStyle(el).getPropertyValue('-webkit-touch-callout'),
        })),
      );
    for (const surface of surfaces) {
      expect(surface.selection, surface.id).toBe('none');
      if (surface.supportsCallout) expect(surface.callout, surface.id).toBe('none');
    }
    expect(
      await page
        .locator('#fallback a')
        .first()
        .evaluate((el) => getComputedStyle(el).userSelect),
    ).not.toBe('none');
  });

  test('holding the rocker repeats and cancellation stops it', async ({ page }) => {
    await atMenu(page);
    const p = await point(page, true);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
    await expect.poll(async () => (await state(page)).sel).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const selected = (await state(page)).sel;
    await page.waitForTimeout(500);
    expect((await state(page)).sel).toBe(selected);
    await expect(page.locator('#monitor-nav')).not.toHaveAttribute('data-direction');
    await expect(page.locator('#cursor')).toBeVisible();
    await cdp.detach();
  });
});

test('desktop keeps the original monitor controls', async ({ page }) => {
  await openSite(page, { viewport: { width: 1280, height: 800 } });
  await skipBoot(page);
  await expect(page.locator('#monitor-controls')).toBeHidden();
});

for (const [name, viewport] of Object.entries({
  landscape: { width: 844, height: 390 },
  ipad: { width: 820, height: 1180 },
})) {
  test.describe(`hardware controls on ${name}`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport });
    test('fit the bezel and activate the selected entry', async ({ page }) => {
      await openSite(page, { viewport });
      await skipBoot(page);
      for (const id of ['#monitor-nav', '#monitor-enter']) {
        const box = await page.locator(id).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      await tapDirection(page, true);
      expect((await state(page)).sel).toBe(1);
      await tapDirection(page, false);
      await page.locator('#monitor-enter').tap();
      await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
      await expect(page.locator('input, textarea, #hint')).toHaveCount(0);
    });
  });
}
