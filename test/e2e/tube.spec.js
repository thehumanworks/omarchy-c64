import path from 'node:path';
import { test, expect } from '@playwright/test';

const PAGE = `file://${path.resolve('dist/index.html')}`;

const screen = (page) => page.evaluate(() => window.__omarchy.screenText().join('\n'));
const state = (page) => page.evaluate(() => window.__omarchy.state());

async function boot(page) {
  await page.goto(PAGE);
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, {
    timeout: 30000,
  });
  await page.evaluate(() => window.__omarchy.skipBoot());
  await expect.poll(() => state(page).then((s) => s.mode)).toBe('app');
}

async function type(page, text) {
  for (const ch of text) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
  await page.keyboard.press('Enter');
}

test('the menu comes up with all fourteen entries', async ({ page }) => {
  await boot(page);
  const text = await screen(page);
  for (const label of ['MANUAL', 'ISO', 'PLUGINS', 'MERCH']) expect(text).toContain(label);
  expect(text).toContain('MAIN MENU');
  expect((await state(page)).page).toBe('menu');
});

test('HELP prints the command set', async ({ page }) => {
  await boot(page);
  await type(page, 'HELP');
  expect(await screen(page)).toContain('THE OMARCHY/64 COMMAND SET');
  expect((await state(page)).page).toBe('help');
});

test('a menu number opens a first-party page on the tube', async ({ page }) => {
  await boot(page);
  await type(page, '6');
  const s = await state(page);
  expect(s.page).toBe('doc');
  expect(s.doc.key).toBe('NEWS');
  expect(await screen(page)).toContain('OMARCHY NEWS');
});

test('the cursor keys move the selection', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect((await state(page)).sel).toBe(2);
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).sel).toBe(1);
});

test('POKE writes the colour registers and SYS 64738 cold starts', async ({ page }) => {
  await boot(page);
  await type(page, 'POKE 53280,2');
  expect((await state(page)).border).toBe(2);
  await type(page, 'SYS 64738');
  expect((await state(page)).mode).toBe('boot');
});
