import { defineConfig } from '@playwright/test';

/* Software WebGL: CI machines have no GPU, and the page is nothing without one. */
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  use: {
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
});
