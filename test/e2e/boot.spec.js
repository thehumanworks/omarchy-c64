// The page comes up clean: WebGL starts, the loader goes away, and the
// accessible fallback nav is in the DOM for machines that never see the tube.
import { expect, test } from '@playwright/test';
import { openSite } from './helpers/page.js';

const TITLE = 'Omarchy — Beautiful, Fun & Opinionated Linux by DHH';

const SR_LINKS = [
  'https://omarchy.org/manual/',
  'https://iso.omarchy.org/omarchy-4.0.1.iso',
  'https://omarchyplugins.com/',
  'https://github.com/omacom/omarchy',
  'https://omarchy.org/security/',
  'https://omarchy.org/news/',
  'https://omarchy.org/teams/',
  'https://omarchy.org/patrons/',
  'https://omarchy.org/sponsorships/',
  'https://omarchy.org/air/',
  'https://discord.gg/tXFUdasqhY',
  'https://omarchy.org/meetups/',
  'https://omarchy.org/workstations/',
  'https://supply.37signals.com/collections/omarchy',
  'https://dhh.dk/',
  'mailto:david@omarchy.org',
];

test('boots into WebGL without page or console errors', async ({ page }) => {
  const errors = await openSite(page);
  await expect(page.locator('body')).toHaveClass(/\bready\b/);
  expect(errors).toEqual([]);
});

test('the loader is removed and no floating badge exists', async ({ page }) => {
  await openSite(page);
  await expect(page.locator('#loader')).toHaveCount(0);
  await expect(page.locator('#gl')).toHaveAttribute('data-hint', '');
  await expect(page.locator('#hint')).toHaveCount(0);
});

test('the canvas covers the whole viewport', async ({ page }) => {
  await openSite(page, { viewport: { width: 1280, height: 800 } });
  const box = await page.locator('#gl').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  expect(box.width).toBe(1280);
  expect(box.height).toBe(800);
});

test('the document title is the Omarchy title', async ({ page }) => {
  await openSite(page);
  await expect(page).toHaveTitle(TITLE);
});

test('the screen-reader nav lists all 16 links', async ({ page }) => {
  await openSite(page);
  const links = page.locator('.sr nav a');
  await expect(links).toHaveCount(SR_LINKS.length);
  expect(await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(
    SR_LINKS,
  );
});
