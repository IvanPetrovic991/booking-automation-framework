import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { futureDate } from '../src/core/utils/dates';
import { StaysQueryBuilder } from '../src/data/builders/StaysQueryBuilder';
import { DESTINATIONS, FLIGHT_ROUTES } from '../src/data/testData';
import { expect, test } from '../src/fixtures/test';

/**
 * README screenshot capture — run with `npm run docs:screenshots`.
 *
 * Deliberately reuses the framework's own page objects and fixtures, so the
 * screenshots always show exactly what the test suite drives. Output goes to
 * docs/screenshots/ (committed to git, embedded in README.md).
 */
const SCREENSHOT_DIR = path.resolve('docs', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test('capture: stays home page with the main search box', async ({ staysHomePage }) => {
  await staysHomePage.open();
  await expect(await staysHomePage.searchBox()).toBeVisible();
  await staysHomePage.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'stays-home.png') });
});

test('capture: stays search results', async ({ staysResultsPage }) => {
  const query = new StaysQueryBuilder()
    .withDestination(DESTINATIONS.mediterranean)
    .withCheckInOffset(40)
    .withNights(3)
    .build();
  await staysResultsPage.openWith(query);
  await staysResultsPage.waitForResults();
  await staysResultsPage.page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'stays-results.png'),
  });
});

test('capture: flights search results (Kayak white-label variant)', async ({ flightsHomePage }) => {
  await flightsHomePage.open();
  const results = await flightsHomePage.searchOneWay(
    FLIGHT_ROUTES.europeanShortHaul,
    futureDate(45),
  );
  await results.waitForResults();
  await results.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flights-results.png') });
});

test('capture: playwright html report with healing-aware suites', async ({ page }) => {
  const reportDir = path.resolve('reports', 'html');
  test.skip(
    !fs.existsSync(path.join(reportDir, 'index.html')),
    'Run `npm test` first to generate reports/html',
  );

  // Serve the report statically; `playwright show-report` would auto-open a browser.
  const server: ChildProcess = spawn('python3', ['-m', 'http.server', '9323', '-d', reportDir], {
    stdio: 'ignore',
  });
  try {
    await expect(async () => {
      await page.goto('http://127.0.0.1:9323/', { waitUntil: 'domcontentloaded' });
    }).toPass({ timeout: 20_000 });
    // Wait for the report app to render the test list.
    await page.getByText('smoke', { exact: false }).first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'html-report.png') });
  } finally {
    server.kill();
  }
});
