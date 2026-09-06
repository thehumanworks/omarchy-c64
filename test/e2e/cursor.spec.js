// The retro pointer sprite: it stands in for the OS cursor over the monitor,
// turns into a hand over anything clickable, and stays at the last touch position.
/* Callbacks in page.evaluate run in the browser, not in Node. */
import { expect, test } from '@playwright/test';
import { openSite, skipBoot } from './helpers/page.js';
import { probeHint, switchRegion, tubeRegion } from './helpers/probe.js';

const VIEWPORT = { width: 1280, height: 800 };

const canvasCursor = (page) =>
  page.evaluate(() => getComputedStyle(document.getElementById('gl')).cursor);

async function atMenu(page, viewport = VIEWPORT) {
  await openSite(page, { viewport });
  await skipBoot(page);
}

test('the sprite is off until the pointer arrives, then it replaces the OS cursor', async ({
  page,
}) => {
  await atMenu(page);
  await expect(page.locator('#cursor')).toBeHidden();
  expect(await canvasCursor(page)).not.toBe('none');

  const x = VIEWPORT.width / 2;
  const y = VIEWPORT.height / 2;
  await page.mouse.move(x, y);
  await expect(page.locator('#cursor')).toBeVisible();
  expect(await canvasCursor(page)).toBe('none');

  // The hot-spot is the arrow's tip: the box's top-left sits on the pointer.
  await expect
    .poll(async () => {
      const box = await page.locator('#cursor').boundingBox();
      return Math.round(Math.max(Math.abs(box.x - x), Math.abs(box.y - y)));
    })
    .toBeLessThanOrEqual(3);
});

test('clickable text gets the hand, blank tube gets the arrow back', async ({ page }) => {
  await atMenu(page);
  const hit = await probeHint(page, tubeRegion(VIEWPORT), 'OPEN MANUAL');
  expect(hit, 'no point on the tube reported OPEN MANUAL').not.toBeNull();
  await expect(page.locator('#cursor')).toHaveClass(/\bhand\b/);

  // A corner of the frame: over the case, never over a clickable row.
  await page.mouse.move(6, 6);
  await expect(page.locator('#cursor')).not.toHaveClass(/\bhand\b/);
});

test('the power switch gets the hand too', async ({ page }) => {
  await atMenu(page);
  const hit = await probeHint(page, switchRegion(VIEWPORT), 'POWER');
  expect(hit, 'no point in the lower-right of the case reported POWER').not.toBeNull();
  await expect(page.locator('#cursor')).toHaveClass(/\bhand\b/);
});

test('leaving the canvas hides the sprite and gives the OS cursor back', async ({ page }) => {
  await atMenu(page);
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await expect(page.locator('#cursor')).toBeVisible();

  await page.evaluate(() => {
    document
      .getElementById('gl')
      .dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
  });
  await expect(page.locator('#cursor')).toBeHidden();
  expect(['auto', 'default']).toContain(await canvasCursor(page));
});

test('reduced motion still shows and hides the sprite', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await atMenu(page);
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await expect(page.locator('#cursor')).toBeVisible();
  await page.evaluate(() => {
    document.getElementById('gl').dispatchEvent(new PointerEvent('pointerleave'));
  });
  await expect(page.locator('#cursor')).toBeHidden();
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('the compact cursor stays visible after release and follows a drag', async ({ page }) => {
    await atMenu(page, { width: 390, height: 844 });
    const cursor = page.locator('#cursor');
    await expect(cursor).toBeVisible();
    await page.touchscreen.tap(120, 190);
    await page.waitForTimeout(1100);
    await expect(cursor).toBeVisible();
    let box = await cursor.boundingBox();
    expect(box.width).toBeLessThanOrEqual(17);
    expect(box.height).toBeLessThanOrEqual(26);
    expect(Math.abs(box.x - 120)).toBeLessThanOrEqual(5);
    expect(Math.abs(box.y - 190)).toBeLessThanOrEqual(1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 120, y: 220 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 260, y: 300 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await page.waitForTimeout(1100);
    await expect(cursor).toBeVisible();
    box = await cursor.boundingBox();
    expect(Math.abs(box.x - 260)).toBeLessThanOrEqual(5);
    expect(Math.abs(box.y - 300)).toBeLessThanOrEqual(1);
    await expect(cursor).not.toHaveClass(/\bdown\b/);
    expect(await canvasCursor(page)).not.toBe('none');
    await expect(page).toHaveScreenshot('phone-cursor.png');
    await page.touchscreen.tap(389, 843);
    box = await cursor.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  });
});

test('desktop-cursor looks right', async ({ page }) => {
  await atMenu(page);
  const hit = await probeHint(page, tubeRegion(VIEWPORT), 'OPEN MANUAL');
  expect(hit, 'no point on the tube reported OPEN MANUAL').not.toBeNull();
  await expect(page.locator('#cursor')).toHaveClass(/\bhand\b/);
  await expect(page).toHaveScreenshot('desktop-cursor.png');
});
