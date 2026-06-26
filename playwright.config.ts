import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/**
 * Self-healing Playwright framework — Playwright configuration.
 * (booking.com is the demo target; see README "About this project".)
 *
 * Scaling notes:
 *  - Products (stays / flights / cars / attractions) are filtered via tags
 *    (`--grep @stays`), browsers via projects (`--project=firefox`).
 *  - Reporters: list (console), HTML + JSON (CI artifacts) and the custom
 *    HealingReporter that consolidates self-healing events after each run.
 */
export default defineConfig({
  testDir: './tests',
  timeout: env.testTimeout,
  expect: { timeout: env.expectTimeout },
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 1,
  workers: env.isCI ? 2 : undefined,
  /** Stop a hopeless CI run early instead of burning the full hour. */
  maxFailures: env.isCI ? 10 : undefined,
  globalTimeout: env.isCI ? 45 * 60 * 1000 : undefined,
  outputDir: 'reports/test-artifacts',
  // CI emits blob reports (merged across shards by `merge-reports`) plus
  // GitHub annotations; local runs get browsable HTML + JSON.
  reporter: env.isCI
    ? [
        ['list'],
        ['github'],
        ['blob', { outputDir: 'reports/blob' }],
        ['./src/core/healing/HealingReporter.ts'],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'reports/html', open: 'never' }],
        ['json', { outputFile: 'reports/results.json' }],
        ['./src/core/healing/HealingReporter.ts'],
      ],
  use: {
    baseURL: env.baseUrl,
    testIdAttribute: 'data-testid',
    headless: env.headless,
    // Viewport comes from each project's device descriptor (1280×720 for the
    // desktop devices below) — a value here would be silently overridden.
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Keeps Chromium from advertising `navigator.webdriver`. This is the
        // only fingerprint adjustment the framework makes — no proxies, no
        // CAPTCHA solving; a bot challenge skips the test instead.
        launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
