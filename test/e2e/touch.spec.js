// Touch: the on-screen keyboard and scrolling a document with a finger.
//
// The suite runs in a touch-emulating context (hasTouch + isMobile), because
// the panel only shows itself on a coarse pointer. The desktop describe at the
// bottom proves the same build keeps the pill out of a mouse user's way.
/* Callbacks in page.evaluate/addInitScript run in the browser, not in Node. */
import { expect, test } from '@playwright/test';
import { hasHook, openSite, skipBoot, state } from './helpers/page.js';
import { probeHint, tubeRegion } from './helpers/probe.js';

const PHONE = { width: 390, height: 844 };

/** Count window resizes from the very first script the page runs. */
async function countResizes(page) {
  await page.addInitScript(() => {
    window.__resizes = 0;
    window.addEventListener('resize', () => (window.__resizes += 1));
  });
}

async function atMenu(page, viewport = PHONE) {
  await openSite(page, { viewport });
  expect(await hasHook(page), 'window.__omarchy test hook is missing').toBe(true);
  await skipBoot(page);
}

const kbd = (page) => page.locator('#kbd');
const pill = (page) => page.locator('#kbd-toggle');

/** Tap an on-screen key by its printed label. */
async function tapKey(page, label) {
  await page
    .locator('#kbd .kbd-key', { hasText: new RegExp(`^${label}$`) })
    .first()
    .dispatchEvent('pointerdown');
}

/** A point on the glass: the row the menu draws MANUAL on. */
async function tubePoint(page, viewport = PHONE) {
  const hit = await probeHint(page, tubeRegion(viewport), 'OPEN MANUAL');
  expect(hit, 'no point on the tube reported OPEN MANUAL').not.toBeNull();
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

  test('the keyboard pill shows, and opening it shifts nothing', async ({ page }) => {
    await countResizes(page);
    await atMenu(page);
    await expect(pill(page)).toBeVisible();
    await expect(kbd(page)).toBeHidden();

    const before = await page.locator('#gl').boundingBox();
    const gridBefore = await state(page);
    const resizesBefore = await page.evaluate(() => window.__resizes);

    await pill(page).dispatchEvent('pointerdown');
    await expect(kbd(page)).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/\bkbd-open\b/);

    const during = await page.locator('#gl').boundingBox();
    const gridDuring = await state(page);
    expect(during).toEqual(before);
    expect([gridDuring.cols, gridDuring.rows]).toEqual([gridBefore.cols, gridBefore.rows]);

    await pill(page).dispatchEvent('pointerdown');
    await expect(kbd(page)).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/\bkbd-open\b/);

    expect(await page.locator('#gl').boundingBox()).toEqual(before);
    const after = await state(page);
    expect([after.cols, after.rows]).toEqual([gridBefore.cols, gridBefore.rows]);
    expect(await page.evaluate(() => window.__resizes)).toBe(resizesBefore);
  });

  test('tapping the tube opens the keyboard', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.touchscreen.tap(hit.x, hit.y);
    await expect(kbd(page)).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/\bkbd-open\b/);
  });

  test('the keys type, navigate and hide the panel', async ({ page }) => {
    await atMenu(page);
    await pill(page).dispatchEvent('pointerdown');
    await expect(kbd(page)).toBeVisible();

    await tapKey(page, '↓');
    expect((await state(page)).sel).toBe(1);

    await tapKey(page, '6');
    expect((await state(page)).input).toBe('6');
    await expect(page.locator('#kbd-echo')).toContainText('READY. 6');

    await tapKey(page, 'RETURN');
    await expect.poll(async () => (await state(page)).page).toBe('doc');
    expect((await state(page)).doc.key).toBe('NEWS');

    await tapKey(page, 'RUN/STOP');
    await expect.poll(async () => (await state(page)).page).toBe('menu');

    await tapKey(page, '▼');
    await expect(kbd(page)).toBeHidden();
  });

  test('a swipe scrolls a document and does not follow a link', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.keyboard.type('1', { delay: 25 });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).page).toBe('doc');
    expect((await state(page)).doc.key).toBe('MANUAL');

    await swipe(page, hit, -220);
    await expect.poll(async () => (await state(page)).doc.off).toBeGreaterThan(0);
    const off = (await state(page)).doc.off;
    expect((await state(page)).page, 'a drag must not launch a link').toBe('doc');
    await expect(kbd(page), 'a drag must not open the keyboard').toBeHidden();

    await swipe(page, hit, 220);
    await expect.poll(async () => (await state(page)).doc.off).toBeLessThan(off);
  });

  test('a plain tap on a doc row still follows the link', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.touchscreen.tap(hit.x, hit.y);
    await expect.poll(async () => (await state(page)).page).toBe('doc');
    expect((await state(page)).doc.key).toBe('MANUAL');
  });
});

for (const [name, viewport] of Object.entries({
  portrait: PHONE,
  landscape: { width: 844, height: 390 },
  ipad: { width: 820, height: 1180 },
})) {
  test.describe(`the panel fits a ${name} screen`, () => {
    test.use({ hasTouch: true, isMobile: true });

    test('inside the viewport', async ({ page }) => {
      await atMenu(page, viewport);
      await pill(page).dispatchEvent('pointerdown');
      await expect(kbd(page)).toBeVisible();
      const box = await kbd(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
      // every key drawn, none clipped away by the max-height
      expect(await page.locator('#kbd .kbd-key').count()).toBe(51);
    });
  });
}

test.describe('phone with the keyboard open looks right', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

  test('golden', async ({ page }) => {
    await atMenu(page);
    await pill(page).dispatchEvent('pointerdown');
    await expect(kbd(page)).toBeVisible();
    await expect(page).toHaveScreenshot('phone-keyboard.png');
  });
});

test.describe('desktop', () => {
  test.use({ hasTouch: false, viewport: { width: 1280, height: 800 } });

  test('keeps the pill and the panel out of the way', async ({ page }) => {
    await atMenu(page, { width: 1280, height: 800 });
    await expect(pill(page)).toBeHidden();
    await expect(kbd(page)).toBeHidden();
  });

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
