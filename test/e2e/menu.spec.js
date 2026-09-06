// What the tube actually says, read back through window.__omarchy.
// Skips on a build without the test hook (see test/e2e/README.md).
import { expect, test } from '@playwright/test';
import {
  expectOnScreen,
  hasHook,
  openSite,
  runCommand,
  screenText,
  skipBoot,
  state,
} from './helpers/page.js';

const LABELS = [
  'MANUAL',
  'ISO',
  'PLUGINS',
  'GITHUB',
  'SECURITY',
  'NEWS',
  'TEAMS',
  'PATRONS',
  'SPONSORS',
  'AIR',
  'DISCORD',
  'MEETUPS',
  'WORKSTATIONS',
  'MERCH',
];

/** Open the page, get to the menu, and bail out cleanly on a hook-less build. */
async function atMenu(page, viewport) {
  await openSite(page, viewport ? { viewport } : {});
  test.skip(!(await hasHook(page)), 'test hook not built yet');
  await skipBoot(page);
}

test('the main menu lists every entry and the READY prompt', async ({ page }) => {
  await atMenu(page);
  const text = (await screenText(page)).join('\n');
  expect(text).toContain('MAIN MENU');
  for (const label of LABELS) expect(text).toContain(label);
  expect(text).toContain('READY.');
});

test('arrow keys move the selection', async ({ page }) => {
  await atMenu(page);
  const before = (await state(page)).sel;
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await state(page)).sel).not.toBe(before);
  const after = (await state(page)).sel;
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state(page)).sel).not.toBe(after);
});

test('typing 6 opens the NEWS page on the tube, Escape goes back', async ({ page }) => {
  await atMenu(page);
  await runCommand(page, '6');
  await expect.poll(async () => (await state(page)).page).toBe('doc');
  await expectOnScreen(page, 'OMARCHY NEWS');

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).page).not.toBe('doc');
  await expectOnScreen(page, 'MAIN MENU');
});

test('HELP prints the command set', async ({ page }) => {
  await atMenu(page);
  await runCommand(page, 'HELP');
  await expectOnScreen(page, 'THE OMARCHY/64 COMMAND SET');
});

test('POKE 53280,2 is acknowledged with OK.', async ({ page }) => {
  await atMenu(page);
  await runCommand(page, 'POKE 53280,2');
  await expect.poll(async () => (await state(page)).status).toContain('OK.');
});

test('SYS 64738 cold starts the machine', async ({ page }) => {
  await atMenu(page);
  await runCommand(page, 'SYS 64738');
  await expect.poll(async () => (await state(page)).mode).toBe('boot');
});
