import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Separate config for documentation tooling (README screenshot capture).
 * Kept out of the main test config so `npm test` never runs these and the
 * main HTML report in reports/html is not overwritten by a docs run.
 */
export default defineConfig({
  testDir: './scripts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 1,
  outputDir: 'reports/docs-artifacts',
  reporter: [['list']],
  use: {
    baseURL: env.baseUrl,
    headless: true,
    locale: 'en-US',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'docs-chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Screenshot geometry lives here, AFTER the device spread — the device
        // descriptor carries its own viewport and would override a top-level one.
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        // Same single fingerprint adjustment as the main config (see there).
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
      },
    },
  ],
});
