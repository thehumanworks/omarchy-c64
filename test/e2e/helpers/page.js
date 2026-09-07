// Shared plumbing for the e2e suites: open the built page, get past the boot
// animation, and read the text off the tube through window.__omarchy.
/* Callbacks in page.evaluate/addInitScript run in the browser, not in Node. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The built, self-contained page. `npm run build`. */
export const DIST = path.resolve(HERE, '..', '..', '..', 'dist', 'index.html');
export const DIST_URL = `file://${DIST}`;

/** How long the CRT takes to warm up and the intro dolly to settle, in ms. */
const SETTLE_MS = 4000;

/**
 * Attach collectors for uncaught exceptions and console errors.
 * Returns the (live) array of messages.
 */
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

/**
 * Open dist/index.html and wait until the app has either come up (body.ready)
 * or given up (body.failed). Throws with the collected console output when the
 * module script threw, because a bare "expected ready" is useless to debug.
 * Returns the live error array so callers can assert on it.
 */
export async function openSite(page, { viewport } = {}) {
  const errors = collectErrors(page);
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(DIST_URL);
  await page.waitForFunction(
    () => document.body.classList.contains('ready') || document.body.classList.contains('failed'),
    null,
    { timeout: 30_000 },
  );
  const failed = await page.evaluate(() => document.body.classList.contains('failed'));
  if (failed) {
    throw new Error(
      `the page failed to start WebGL:\n${errors.join('\n') || '(no errors logged)'}`,
    );
  }
  return errors;
}

/** True when the built page exposes the window.__omarchy test hook. */
export function hasHook(page) {
  return page.evaluate(() => typeof window.__omarchy?.skipBoot === 'function');
}

/** A snapshot of the machine state: { mode, page, sel, input, powered, cols, rows, status, doc? }. */
export function state(page) {
  return page.evaluate(() => window.__omarchy.state());
}

/** The tube's text, one string per row. */
export function screenText(page) {
  return page.evaluate(() => window.__omarchy.screenText());
}

/**
 * Get to the main menu through the test hook, then wait for the machine to be
 * in app mode. Never times the animation by wall clock: under SwiftShader the
 * boot runs at roughly 10 fps and any frame-count assumption would flake.
 */
export async function skipBoot(page) {
  await page.evaluate(() => window.__omarchy.skipBoot());
  await page.waitForFunction(() => window.__omarchy.state().mode === 'app', null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(SETTLE_MS);
}

/** Poll the tube until `text` shows up somewhere on it. */
export async function expectOnScreen(page, text, timeout = 15_000) {
  await expect
    .poll(() => page.evaluate(() => window.__omarchy.screenText().join('\n')), { timeout })
    .toContain(text);
}

/** Type a command into the BASIC prompt and run it. */
export async function runCommand(page, cmd) {
  await page.keyboard.type(cmd, { delay: 25 });
  await page.keyboard.press('Enter');
}
