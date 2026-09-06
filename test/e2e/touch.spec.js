// Native input and stable monitor geometry. Headless browsers do not draw OS
// keyboards: visual-viewport changes below simulate their occlusion explicitly.
import { expect, test } from '@playwright/test';
import { openSite, skipBoot, state } from './helpers/page.js';
import { probeHint, tubeRegion } from './helpers/probe.js';

const PHONE = { width: 390, height: 844 };
const command = (page) => page.locator('#command');
async function atMenu(page, viewport = PHONE) {
  await openSite(page, { viewport });
  await skipBoot(page);
}
async function tubePoint(page, viewport = PHONE) {
  const hit = await probeHint(page, tubeRegion(viewport), 'OPEN MANUAL');
  expect(hit).not.toBeNull();
  return hit;
}
async function openInput(page, viewport = PHONE) {
  const region = { ...tubeRegion(viewport), y0: Math.round(viewport.height * 0.72) };
  const point = await probeHint(page, region, 'READY.');
  expect(point, 'READY prompt was not found').not.toBeNull();
  await page.touchscreen.tap(point.x, point.y);
  await expect(command(page)).toBeFocused();
}
async function mockViewport(page) {
  await page.addInitScript(() => {
    window.__viewport = Object.assign(new EventTarget(), {
      width: innerWidth,
      height: innerHeight,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { value: window.__viewport });
  });
}
async function occlude(page, height, offsetTop = 0) {
  await page.evaluate(
    (v) => {
      Object.assign(window.__viewport, v);
      window.__viewport.dispatchEvent(new Event('resize'));
    },
    { height, offsetTop },
  );
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

  test('native typing, deletion, selection replacement and submission work once', async ({
    page,
  }) => {
    await atMenu(page);
    await expect(page.locator('#kbd, #kbd-toggle, .kbd-key')).toHaveCount(0);
    await openInput(page);
    await page.keyboard.insertText('helpx');
    expect((await state(page)).input).toBe('HELPX');
    await page.keyboard.press('Backspace');
    expect((await state(page)).input).toBe('HELP');
    await command(page).evaluate((el) => el.select());
    await page.keyboard.insertText('6');
    expect((await state(page)).input).toBe('6');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page)).doc?.key).toBe('NEWS');
    expect((await state(page)).input).toBe('');
    await expect(command(page)).not.toBeFocused();
    await openInput(page);
    await page.keyboard.insertText('HELP');
    await page.keyboard.press('Escape');
    expect((await state(page)).page).toBe('menu');
    expect((await state(page)).input).toBe('');
    await expect(command(page)).not.toBeFocused();
  });

  test('composition is not overwritten by repaint and paste remains bounded', async ({ page }) => {
    await atMenu(page);
    await openInput(page);
    await command(page).dispatchEvent('compositionstart');
    await command(page).evaluate((el) => {
      el.value = 'help';
      el.dispatchEvent(new InputEvent('input', { data: 'help', isComposing: true }));
    });
    await page.waitForTimeout(200);
    await expect(command(page)).toHaveValue('help');
    expect((await state(page)).input).toBe('');
    await command(page).dispatchEvent('compositionend');
    expect((await state(page)).input).toBe('HELP');
    await command(page).fill('a'.repeat(40));
    expect((await state(page)).input).toBe('A'.repeat(30));
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
    await expect(command(page)).not.toBeFocused();
    await swipe(page, hit, 220);
    await expect.poll(async () => (await state(page)).doc.off).toBeLessThan(off);
    expect((await state(page)).doc.key).toBe('MANUAL');
  });

  test('link taps open the page without summoning a keyboard', async ({ page }) => {
    await atMenu(page);
    const hit = await tubePoint(page);
    await page.touchscreen.tap(hit.x, hit.y);
    await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
    await expect(command(page)).not.toBeFocused();
  });

  test('window-height changes do not reflow typing; rotation still works', async ({ page }) => {
    await atMenu(page);
    const before = await page.locator('#gl').boundingBox();
    const grid = await state(page);
    await openInput(page);
    await page.setViewportSize({ width: 390, height: 500 });
    expect(await page.locator('#gl').boundingBox()).toEqual(before);
    const during = await state(page);
    expect([during.cols, during.rows]).toEqual([grid.cols, grid.rows]);
    const field = await command(page).boundingBox();
    expect(field.y + field.height).toBeLessThanOrEqual(500);
    await command(page).evaluate((el) => el.blur());
    expect(await page.locator('#gl').boundingBox()).toEqual(before);
    await page.setViewportSize(PHONE);
    expect(await page.locator('#gl').boundingBox()).toEqual(before);
    await openInput(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(command(page)).not.toBeFocused();
    await expect.poll(async () => (await page.locator('#gl').boundingBox()).width).toBe(844);
    expect((await page.locator('#gl').boundingBox()).height).toBe(390);
  });

  test('a cancelled gesture does not open native input', async ({ page }) => {
    await atMenu(page);
    await page.locator('#gl').dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 9,
      clientX: 195,
      clientY: 186,
    });
    await page
      .locator('#gl')
      .dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 9 });
    await page.locator('#gl').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 9 });
    await expect(command(page)).not.toBeFocused();
  });
});

for (const [name, viewport] of Object.entries({
  portrait: PHONE,
  landscape: { width: 844, height: 390 },
  ipad: { width: 820, height: 1180 },
})) {
  test.describe(`native keyboard viewport on ${name}`, () => {
    test.use({ hasTouch: true, isMobile: true });
    test('canvas and grid stay stable while input stays above keyboard', async ({ page }) => {
      await mockViewport(page);
      await atMenu(page, viewport);
      const before = await page.locator('#gl').boundingBox();
      const grid = await state(page);
      await openInput(page, viewport);
      const visible = Math.round(viewport.height * 0.55);
      await occlude(page, visible);
      const box = await command(page).boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(visible);
      expect(await page.locator('#gl').boundingBox()).toEqual(before);
      const during = await state(page);
      expect([during.cols, during.rows]).toEqual([grid.cols, grid.rows]);
      await page.keyboard.insertText('HELP');
      if (name === 'portrait') await expect(page).toHaveScreenshot('phone-native-input.png');
      // Browser panning: keep the monitor anchored to the visible top.
      await occlude(page, visible, 70);
      const panned = await page.locator('#gl').boundingBox();
      expect(panned.y - 70).toBe(before.y);
      expect(panned.height).toBe(before.height);
      await command(page).evaluate((el) => el.blur());
      await occlude(page, viewport.height);
      expect(await page.locator('#gl').boundingBox()).toEqual(before);
      await openInput(page, viewport);
      await expect(command(page)).toHaveValue('HELP');
    });
  });
}

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
