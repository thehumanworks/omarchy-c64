// The text grid is not fixed at 40x25: a phone gets a narrow, tall tube with the
// menu stacked one entry per row, a wide screen gets the full 40 columns.
// Skips without the test hook.
import { expect, test } from '@playwright/test';
import { hasHook, openSite, screenText, skipBoot, state } from './helpers/page.js';

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

async function atMenu(page, viewport) {
  await openSite(page, { viewport });
  test.skip(!(await hasHook(page)), 'test hook not built yet');
  await skipBoot(page);
}

test('a phone gets a narrow, tall grid with the menu stacked', async ({ page }) => {
  await atMenu(page, { width: 390, height: 844 });

  const { cols, rows } = await state(page);
  expect(cols).toBeLessThan(40);
  expect(rows).toBeGreaterThan(25);

  const lines = await screenText(page);
  const rowOf = new Map();
  for (const label of LABELS) {
    const i = lines.findIndex((line, r) => line.includes(label) && !rowOf.has(r));
    expect(i, `no row carries ${label}`).toBeGreaterThanOrEqual(0);
    rowOf.set(i, label);
  }
  // one entry per row: 14 labels landed on 14 distinct rows
  expect(rowOf.size).toBe(LABELS.length);
});

test('an ultrawide screen keeps the 40-column grid', async ({ page }) => {
  await atMenu(page, { width: 2560, height: 800 });
  expect((await state(page)).cols).toBe(40);
});
