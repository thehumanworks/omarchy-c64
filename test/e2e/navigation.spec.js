// Getting around the machine: the keyboard's selection cycle, the typed
// commands, the static pages, a shortcut that leaves for the web, and the two
// pieces of hardware you steer with the mouse. Every expected string comes from
// `content/`. Skips without the test hook (see test/e2e/README.md).
import { expect, test } from '@playwright/test';
import { expectOnScreen, runCommand, screenText, state } from './helpers/page.js';
import { hintText, probeHint, switchRegion } from './helpers/probe.js';
import { asTube, atMenu } from './helpers/tube.js';
import { menu, shortcuts, strings } from './helpers/content.js';

const VIEWPORT = { width: 1280, height: 800 };

/** Let the render loop run: SwiftShader manages about ten frames a second. */
const FRAMES_MS = 700;

/** The four pages the command table draws itself, and the state each lands in. */
const TEXT_PAGES = [
  ['HELP', 'help', strings.help.title],
  ['ABOUT', 'about', strings.about.title],
  ['LIST', 'list', strings.list.title],
  ['DIR', 'dir', strings.dir.title],
];

const sel = async (page) => (await state(page)).sel;

test('Tab and Shift+Tab cycle the selection through every entry', async ({ page }) => {
  await atMenu(page, VIEWPORT);
  expect(await sel(page)).toBe(0);

  const forward = [];
  for (let i = 0; i < menu.length; i++) {
    await page.keyboard.press('Tab');
    forward.push(await sel(page));
  }
  // 1, 2, ... 13, and round to 0 again
  expect(forward).toEqual(menu.map((_, i) => (i + 1) % menu.length));

  const back = [];
  for (let i = 0; i < menu.length; i++) {
    await page.keyboard.press('Shift+Tab');
    back.push(await sel(page));
  }
  expect(back).toEqual(menu.map((_, i) => menu.length - 1 - i));
});

test('a full label and a three-letter prefix both open the right page', async ({ page }) => {
  await atMenu(page, VIEWPORT);

  await runCommand(page, 'MEETUPS');
  await expect.poll(async () => (await state(page)).doc?.key).toBe('MEETUPS');

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).page).toBe('menu');

  await runCommand(page, 'SEC');
  await expect.poll(async () => (await state(page)).doc?.key).toBe('SECURITY');
});

test('HELP, ABOUT, LIST and DIR print their pages, RUN goes back', async ({ page }) => {
  await atMenu(page, VIEWPORT);
  for (const [command, mode, title] of TEXT_PAGES) {
    await runCommand(page, command);
    await expect.poll(async () => (await state(page)).page).toBe(mode);
    await expectOnScreen(page, asTube(title));
  }
  await runCommand(page, 'RUN');
  await expect.poll(async () => (await state(page)).page).toBe('menu');
  await expectOnScreen(page, asTube(strings.menu.caption.trim()));
});

test('an unknown command is a syntax error', async ({ page }) => {
  await atMenu(page, VIEWPORT);
  await runCommand(page, 'ZXQJ');
  await expect.poll(async () => (await state(page)).status).toBe(strings.status.syntax);
  expect((await state(page)).page).toBe('menu');
});

test('a shortcut name opens a new tab', async ({ page, context }) => {
  await atMenu(page, VIEWPORT);
  // Offline-safe: nothing in this suite may touch the real network. The stub
  // still lets the popup commit, so its URL is observable.
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (/^https?:/i.test(url)) return route.fulfill({ status: 200, body: '' });
    return route.continue();
  });

  const [tab] = await Promise.all([context.waitForEvent('page'), runCommand(page, 'DHH')]);
  await tab.waitForLoadState('domcontentloaded').catch(() => {});
  expect(tab.url()).toBe(shortcuts.DHH);
  await tab.close();
});

test('the power switch cuts the machine dead, and RETURN cold starts it', async ({ page }) => {
  await atMenu(page, VIEWPORT);
  const hit = await probeHint(page, switchRegion(VIEWPORT), strings.labels.power);
  expect(hit, 'no point in the lower-right of the case reported POWER').not.toBeNull();

  await page.mouse.click(hit.x, hit.y);
  await expect.poll(async () => (await state(page)).powered).toBe(false);

  // With no power the render loop stops stepping the machine: the tube keeps
  // whatever was on it and no keystroke reaches the prompt.
  const frozen = await screenText(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('A');
  await page.waitForTimeout(FRAMES_MS);
  expect((await state(page)).input, 'a key reached the prompt with the power off').toBe('');
  expect(await screenText(page), 'the tube repainted with the power off').toEqual(frozen);

  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).mode).toBe('boot');
  await expect.poll(async () => (await state(page)).powered).toBe(true);
});

test('dragging the BRIGHT knob reports a percentage', async ({ page }) => {
  await atMenu(page, VIEWPORT);
  const hit = await probeHint(page, switchRegion(VIEWPORT), strings.labels.bright);
  expect(hit, 'no point on the case reported the BRIGHTNESS knob').not.toBeNull();

  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(hit.x, hit.y - i * 6);
  await expect.poll(() => hintText(page)).toMatch(/^BRIGHT \d{1,3}%$/);
  await page.mouse.up();
  await expect.poll(() => hintText(page)).toBe('');
});
