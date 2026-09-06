// The retro pointer sprite: it stands in for the OS cursor over the monitor,
// turns into a hand over anything clickable, and echoes a touch for a moment.
/* Callbacks in page.evaluate run in the browser, not in Node. */
import { expect, test } from '@playwright/test';
import { openSite, skipBoot } from './helpers/page.js';
import { probeHint, switchRegion, tubeRegion } from './helpers/probe.js';

const VIEWPORT = { width: 1280, height: 800 };

const canvasCursor = (page) =>
  page.evaluate(() => getComputedStyle(document.getElementById('gl')).cursor);

const shown = (page) =>
  page.evaluate(() => document.getElementById('cursor').classList.contains('on'));

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
  test.use({ hasTouch: true });

  test('a tap shows the sprite where the finger was, then fades it away', async ({ page }) => {
    await atMenu(page);
    const x = Math.round(VIEWPORT.width / 2);
    const y = Math.round(VIEWPORT.height / 2);
    // The sprite fades out 700ms after the touch, which is less than a couple of
    // round trips under software GL, so catch it as it appears instead.
    await page.evaluate(() => {
      const el = document.getElementById('cursor');
      window.__seen = null;
      new MutationObserver(() => {
        if (window.__seen || !el.classList.contains('on')) return;
        const r = el.getBoundingClientRect();
        const gl = document.getElementById('gl');
        window.__seen = { x: r.x, y: r.y, cursor: getComputedStyle(gl).cursor };
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    await page.touchscreen.tap(x, y);

    const seen = await page.evaluate(() => window.__seen);
    expect(seen, 'the sprite did not come up on tap').not.toBeNull();
    expect(Math.abs(seen.x - x)).toBeLessThanOrEqual(4);
    expect(Math.abs(seen.y - y)).toBeLessThanOrEqual(4);
    // A touch leaves the OS cursor alone.
    expect(seen.cursor).not.toBe('none');

    await expect.poll(() => shown(page), { timeout: 3000 }).toBe(false);
    await expect(page.locator('#cursor')).toBeHidden();
  });
});

test('desktop-cursor looks right', async ({ page }) => {
  await atMenu(page);
  const hit = await probeHint(page, tubeRegion(VIEWPORT), 'OPEN MANUAL');
  expect(hit, 'no point on the tube reported OPEN MANUAL').not.toBeNull();
  await expect(page.locator('#cursor')).toHaveClass(/\bhand\b/);
  await expect(page).toHaveScreenshot('desktop-cursor.png');
});
