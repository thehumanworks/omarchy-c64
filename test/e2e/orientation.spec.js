import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openSite, skipBoot, state } from './helpers/page.js';
import { probeHint, tubeRegion } from './helpers/probe.js';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

async function expectViewport(page, size, dpr) {
  await expect
    .poll(() =>
      page.locator('#gl').evaluate((canvas) => {
        const gl = canvas.getContext('webgl2');
        return {
          css: { width: canvas.clientWidth, height: canvas.clientHeight },
          pixels: [canvas.width, canvas.height],
          drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
          viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
        };
      }),
    )
    .toEqual({
      css: size,
      pixels: [size.width * dpr, size.height * dpr],
      drawingBuffer: [size.width * dpr, size.height * dpr],
      viewport: [0, 0, size.width * dpr, size.height * dpr],
    });
  await expect
    .poll(async () => {
      const grid = await state(page);
      return [grid.cols, grid.rows];
    })
    .toEqual(size.width > size.height ? [40, 25] : [30, 60]);
}

async function exerciseTargets(page, size) {
  for (const selector of ['#monitor-nav', '#monitor-enter']) {
    const r = await page.locator(selector).boundingBox();
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(size.width);
    expect(r.y + r.height).toBeLessThanOrEqual(size.height);
  }
  const nav = await page.locator('#monitor-nav').boundingBox();
  const selected = (await state(page)).sel;
  await page.touchscreen.tap(nav.x + nav.width / 2, nav.y + nav.height * 0.8);
  expect((await state(page)).sel).not.toBe(selected);
  await page.touchscreen.tap(nav.x + nav.width / 2, nav.y + nav.height * 0.2);
  expect((await state(page)).sel).toBe(selected);
  const hit = await probeHint(page, tubeRegion(size), 'OPEN MANUAL');
  expect(hit).not.toBeNull();
  await page.touchscreen.tap(hit.x, hit.y);
  await expect.poll(async () => (await state(page)).doc?.key).toBe('MANUAL');
  await page.locator('#monitor-enter').tap();
  await expect.poll(async () => (await state(page)).page).toBe('menu');
  await expect(
    page.locator('input, textarea, [contenteditable], #hint, #kbd, #kbd-toggle'),
  ).toHaveCount(0);
  await expect(page.locator('#cursor')).toBeVisible();
}

test.describe('orientation on a running mobile monitor', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PORTRAIT, deviceScaleFactor: 1 });

  test('portrait → landscape → portrait updates pixels, grid and touch targets', async ({
    page,
  }, info) => {
    const errors = await openSite(page);
    await skipBoot(page);
    const cdp = await page.context().newCDPSession(page);
    for (const [name, size, dpr, angle] of [
      ['portrait', PORTRAIT, 1, 0],
      ['landscape', LANDSCAPE, 2, 90],
      ['portrait-return', PORTRAIT, 1, 0],
    ]) {
      await page.setViewportSize(size);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        ...size,
        deviceScaleFactor: dpr,
        mobile: true,
        screenOrientation: { type: angle ? 'landscapePrimary' : 'portraitPrimary', angle },
      });
      await expectViewport(page, size, dpr);
      await exerciseTargets(page, size);
      // Let the CRT's intentional phosphor persistence clear the document.
      await page.waitForTimeout(1000);
      // Playwright's screenshot helper restores the context's initial DPR.
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const image = Buffer.from(shot.data, 'base64');
      await writeFile(info.outputPath(`${name}.png`), image);
      if (name === 'landscape') {
        expect(image).toMatchSnapshot('landscape.png', { maxDiffPixelRatio: 0.05, threshold: 0.3 });
      }
      await expectViewport(page, size, dpr);
    }
    await cdp.detach();
    expect(errors).toEqual([]);
  });

  test('late CSS size and DPR settle without another window resize', async ({ page }) => {
    const errors = await openSite(page);
    await skipBoot(page);
    // Hold the old canvas bounds while the browser reports its new orientation.
    await page.locator('#gl').evaluate((canvas) => {
      canvas.style.width = `${canvas.clientWidth}px`;
      canvas.style.height = `${canvas.clientHeight}px`;
      window.__orientationResizeSeen = false;
      window.addEventListener(
        'resize',
        () => {
          window.__orientationResizeSeen = true;
        },
        { once: true },
      );
    });
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await page.setViewportSize(LANDSCAPE);
    await page.waitForFunction(() => window.__orientationResizeSeen);
    await expectViewport(page, PORTRAIT, 1);
    // CSS settles after resize; only visualViewport emits another event.
    await page.locator('#gl').evaluate((canvas) => {
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await expectViewport(page, LANDSCAPE, 1);
    // A display-density change can also arrive after the size events.
    await page.evaluate(() => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    });
    await expectViewport(page, LANDSCAPE, 2);
    await page.evaluate(() => {
      delete window.devicePixelRatio;
    });
    await page.setViewportSize(PORTRAIT);
    await expectViewport(page, PORTRAIT, 1);
    expect(errors).toEqual([]);
  });
});
