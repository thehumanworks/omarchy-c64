// Every first-party page, read on the tube.
//
// One test per page, generated from `content/menu.json` + `content/pages/*.json`
// through `src/content/index.js`, so the assertions are derived from the data
// the page was built from rather than copied out of it. A failure names the
// page that broke. The test hook is required (see test/e2e/README.md).
import { expect, test } from '@playwright/test';
import { expectOnScreen, runCommand, state } from './helpers/page.js';
import { asTube, atMenu } from './helpers/tube.js';
import {
  boxInner,
  DOC_ENTRIES,
  docRowCount,
  docTitle,
  firstHeading,
  linkRowCount,
  strings,
} from './helpers/content.js';

const VIEWPORT = { width: 1280, height: 800 };
const FRAMES_MS = 500;

/** Open the doc that menu entry `number` points at and settle on it. */
async function openEntry(page, entry) {
  await runCommand(page, String(entry.number));
  await expect.poll(async () => (await state(page)).page).toBe('doc');
  const open = (await state(page)).doc.key;
  expect(open, 'the open document is not the entry that was typed').toBe(entry.label);
}

/**
 * Page down through the whole document, adding up the hit boxes each screenful
 * registers. Successive screens overlap (the jump is two rows shorter than the
 * box), so every row is seen at least once and the total is a lower bound on
 * the document's clickable rows.
 */
async function sweepHits(page) {
  const s = await state(page);
  const screens = Math.ceil(s.docLines / Math.max(1, s.rows - 8));
  let seen = 0;
  let off = 0;
  for (let i = 0; i <= screens + 2; i++) {
    seen += (await state(page)).hits;
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(FRAMES_MS);
    const next = (await state(page)).doc.off;
    if (next === off) return seen;
    off = next;
  }
  throw new Error(`still paging after ${screens + 3} screens`);
}

for (const entry of DOC_ENTRIES) {
  test(`${entry.label} opens on the tube, scrolls and closes`, async ({ page }) => {
    await atMenu(page, VIEWPORT, { settle: false });
    const { cols, rows } = await state(page);

    await openEntry(page, entry);

    // the box header and the page's first heading, laid out the way the
    // renderers lay them out and read back the way the tube reads back
    await expectOnScreen(page, asTube(docTitle(entry.page, cols)));
    const heading = firstHeading(entry.page, cols);
    expect(heading, `${entry.label} has no H2 to show`).toBeTruthy();
    await expectOnScreen(page, asTube(heading));

    // every A node in the page becomes a clickable row somewhere in the doc
    const links = linkRowCount(entry.page, cols);
    expect(links, `${entry.label} carries no links`).toBeGreaterThan(0);
    expect(await sweepHits(page)).toBeGreaterThanOrEqual(links);

    // End goes to the bottom of a document that is longer than the box
    const scrollable = docRowCount(entry.page, cols) > boxInner(rows);
    await page.keyboard.press('End');
    await page.waitForTimeout(FRAMES_MS);
    const bottom = (await state(page)).doc.off;
    if (scrollable) expect(bottom, 'End did not scroll').toBeGreaterThan(0);
    else expect(bottom, 'a document that fits scrolled anyway').toBe(0);

    // Home comes back to the top, Escape back to the menu
    await page.keyboard.press('Home');
    await expect.poll(async () => (await state(page)).doc.off).toBe(0);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).page).toBe('menu');
    await expectOnScreen(page, asTube(strings.menu.caption.trim()));
  });
}
