// Golden screenshots of the monitor at three shapes. The CRT paints animated
// film grain, so these compare under the tolerance set in playwright.config.js
// rather than pixel for pixel. Refresh with `npm run test:e2e:update`.
import { expect, test } from '@playwright/test';
import { openSite, skipBoot } from './helpers/page.js';

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
  ultrawide: { width: 2560, height: 800 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`${name} looks right`, async ({ page }) => {
    await openSite(page, { viewport });
    await skipBoot(page);
    await expect(page).toHaveScreenshot(`${name}.png`);
  });
}
