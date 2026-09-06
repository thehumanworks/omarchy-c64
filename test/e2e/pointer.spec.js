// Pointing at the machine: hardware labels, clicking a menu row on the tube, and
// third-party entries opening a new tab. Skips without the test hook.
import { expect, test } from '@playwright/test';
import { hasHook, openSite, screenText, skipBoot, state } from './helpers/page.js';
import { probeHint, switchRegion, tubeRegion } from './helpers/probe.js';

const VIEWPORT = { width: 1280, height: 800 };

async function atMenu(page) {
  await openSite(page, { viewport: VIEWPORT });
  test.skip(!(await hasHook(page)), 'test hook not built yet');
  await skipBoot(page);
}

test('hovering the power switch labels it POWER', async ({ page }) => {
  await atMenu(page);
  const hit = await probeHint(page, switchRegion(VIEWPORT), 'POWER');
  expect(hit, 'no point in the lower-right of the case reported POWER').not.toBeNull();
  await expect(page.locator('#hint')).toHaveText('POWER');
  await expect(page.locator('#hint')).toHaveClass(/\bon\b/);
});

test('clicking the MANUAL row on the tube opens the doc', async ({ page }) => {
  await atMenu(page);
  const rows = await screenText(page);
  expect(rows.some((r) => r.includes('MANUAL'))).toBe(true);

  const hit = await probeHint(page, tubeRegion(VIEWPORT), 'OPEN MANUAL');
  expect(hit, 'no point on the tube reported OPEN MANUAL').not.toBeNull();
  await page.mouse.click(hit.x, hit.y);
  await expect.poll(async () => (await state(page)).page).toBe('doc');
});

test('a third-party entry opens a new tab', async ({ page, context }) => {
  await atMenu(page);
  // Offline-safe: nothing in this suite may touch the real network. The stub
  // still lets the popup commit, so its URL is observable.
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^https?:/i.test(url)) return route.fulfill({ status: 200, body: '' });
    return route.continue();
  });

  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page.keyboard.type('4', { delay: 25 }).then(() => page.keyboard.press('Enter')),
  ]);
  await tab.waitForLoadState('domcontentloaded').catch(() => {});
  expect(tab.url()).toMatch(/^https:\/\/github\.com\//);
  await tab.close();
});
