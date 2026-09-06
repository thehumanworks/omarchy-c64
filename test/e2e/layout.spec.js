// The tube on six shapes of screen, from a phone held upright to a 2560-wide
// desktop. The grid is chosen from the aperture's aspect (`src/text/grid.js`),
// so every one of these is a different terminal: what has to hold is that the
// machine boots clean, nothing overruns the right rail, the menu box is whole
// and the chrome — READY prompt and ticker — is still on screen.
// Skips without the test hook (see test/e2e/README.md).
import { expect, test } from '@playwright/test';
import { screenText, state } from './helpers/page.js';
import { asTube, atMenu, isRail, RAIL, rowWith } from './helpers/tube.js';
import { strings } from './helpers/content.js';

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
  laptop: { width: 1440, height: 900 },
  'small-desktop': { width: 1024, height: 768 },
  wide: { width: 2560, height: 800 },
};

const CAPTION = strings.menu.caption.trim();

/** The menu's box: a captioned top rail, and a plain rail closing it below. */
function expectMenuBox(rows, cols) {
  const top = rowWith(rows, asTube(CAPTION));
  expect(top, `no row carries the ${CAPTION} caption`).toBeGreaterThanOrEqual(0);

  const rail = rows[top];
  expect(rail.length, 'the caption row is not the width of the grid').toBe(cols);
  expect(rail, 'the caption row has no rail either side of it').toContain(RAIL);
  expect(rail.split(RAIL).join('').trim(), 'something else is on the caption row').toBe(CAPTION);

  const bottom = rows.slice(top + 1).findIndex((row) => isRail(row, cols));
  expect(bottom, 'the menu box never closes').toBeGreaterThanOrEqual(0);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`${name} boots into a whole menu`, async ({ page }) => {
    const errors = await atMenu(page, viewport);
    expect(errors, 'the page logged errors on the way up').toEqual([]);

    const { cols, rows: gridRows } = await state(page);
    expect(cols, 'the grid is not one of the shapes grid.js can pick').toBeGreaterThanOrEqual(30);
    expect(cols).toBeLessThanOrEqual(40);
    expect(gridRows).toBeGreaterThanOrEqual(25);
    expect(gridRows).toBeLessThanOrEqual(60);

    const rows = await screenText(page);
    expect(rows.length).toBe(gridRows);
    for (const [i, row] of rows.entries()) {
      expect(row.length, `row ${i} is wider than the ${cols}-column grid`).toBeLessThanOrEqual(
        cols,
      );
    }

    expectMenuBox(rows, cols);

    // the chrome: the prompt, then the ticker on the very last row
    expect(rows[gridRows - 2].startsWith(asTube(strings.chrome.ready))).toBe(true);
    const ticker = asTube(strings.ticker);
    expect(
      (ticker + ticker).includes(rows[gridRows - 1]),
      'the last row is not a window on the ticker',
    ).toBe(true);
  });
}

// The two shapes the golden set did not cover. `visual.spec.js` owns desktop,
// phone and ultrawide; these live here so the tablet cases travel with the rest
// of the layout proof.
test.describe('looks right', () => {
  for (const name of ['ipad-portrait', 'ipad-landscape']) {
    test(name, async ({ page }) => {
      await atMenu(page, VIEWPORTS[name]);
      await expect(page).toHaveScreenshot(`${name}.png`);
    });
  }
});
