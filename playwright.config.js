// Playwright drives the *built* page: dist/index.html is self-contained (three.js,
// the character ROM and every texture are inlined), so it is opened over file://
// and no web server is involved. See test/e2e/README.md.
import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

// Software GL. Chromium headless has no GPU here, so ANGLE is pointed at
// SwiftShader; without --enable-unsafe-swiftshader Chromium refuses to hand a
// WebGL context to a page, and --ignore-gpu-blocklist keeps it from bailing out
// on the virtual adapter. Rendering runs at roughly 10 fps as a result, which is
// why nothing in the suite times the boot animation by wall clock.
const GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: false,
  workers: 1, // software GL is CPU-heavy: one browser at a time, everywhere
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // A 2560x800 WebGL capture under SwiftShader on a 2-core CI runner takes
  // several seconds, and toHaveScreenshot needs two of them to settle.
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Goldens are platform independent on purpose: the same files are compared on
  // macOS dev machines and on Linux CI, hence no {platform} in the path.
  snapshotPathTemplate: 'test/e2e/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    timeout: 45_000,
    // The CRT shader paints animated film grain, so a pixel-exact match is not a
    // thing. The tolerance catches layout and colour regressions, not noise.
    toHaveScreenshot: { maxDiffPixelRatio: 0.05, threshold: 0.3, animations: 'disabled' },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', launchOptions: { args: GL_ARGS } },
    },
  ],
});
