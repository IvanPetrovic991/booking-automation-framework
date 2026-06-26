import { test as base } from '@playwright/test';
import { env } from '../config/env';
import { healingStore, HealingStore } from '../core/healing/HealingStore';
import { SelfHealingLocator } from '../core/healing/SelfHealingLocator';
import { HeaderNav } from '../pages/components/HeaderNav';
import { StaysHomePage } from '../pages/stays/StaysHomePage';
import { StaysResultsPage } from '../pages/stays/StaysResultsPage';
import { FlightsHomePage } from '../pages/flights/FlightsHomePage';
import { CarRentalHomePage } from '../pages/cars/CarRentalHomePage';
import { AttractionsHomePage } from '../pages/attractions/AttractionsHomePage';

/** Third-party analytics/tracker hosts aborted when BLOCK_TRACKERS is on. */
const TRACKER_URL_PATTERN =
  /google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.(net|com)\/tr|hotjar\.com|criteo\.(com|net)|bing\.com\/bat|tiktok\.com\/i18n/;

interface Fixtures {
  blockTrackers: void;
  consoleErrorTracker: void;
  healingStoreInstance: HealingStore;
  healer: SelfHealingLocator;
  headerNav: HeaderNav;
  staysHomePage: StaysHomePage;
  staysResultsPage: StaysResultsPage;
  flightsHomePage: FlightsHomePage;
  carRentalHomePage: CarRentalHomePage;
  attractionsHomePage: AttractionsHomePage;
}

/**
 * Project-wide test object. Every spec imports { test, expect } from here —
 * page objects arrive pre-wired with a shared self-healing locator, so specs
 * contain only intent, never construction boilerplate.
 *
 * Adding a new page object = one fixture line here.
 */
export const test = base.extend<Fixtures>({
  /** Auto: abort third-party tracker requests — faster and more stable runs. */
  blockTrackers: [
    async ({ context }, use) => {
      if (env.blockTrackers) {
        await context.route(TRACKER_URL_PATTERN, (route) => route.abort());
      }
      await use();
    },
    { auto: true },
  ],

  /**
   * Auto: collect browser console errors and uncaught page errors and attach
   * them to the test report — invaluable when triaging failures from CI.
   */
  consoleErrorTracker: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`[console.error] ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`[pageerror] ${String(error)}`));
      await use();
      if (errors.length > 0) {
        await testInfo.attach('browser-console-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],

  healingStoreInstance: async ({}, use) => {
    await use(healingStore);
  },
  healer: async ({ page, healingStoreInstance }, use) => {
    await use(new SelfHealingLocator(page, healingStoreInstance));
  },
  headerNav: async ({ page, healer }, use) => {
    await use(new HeaderNav(page, healer));
  },
  staysHomePage: async ({ page, healer }, use) => {
    await use(new StaysHomePage(page, healer));
  },
  staysResultsPage: async ({ page, healer }, use) => {
    await use(new StaysResultsPage(page, healer));
  },
  flightsHomePage: async ({ page, healer }, use) => {
    await use(new FlightsHomePage(page, healer));
  },
  carRentalHomePage: async ({ page, healer }, use) => {
    await use(new CarRentalHomePage(page, healer));
  },
  attractionsHomePage: async ({ page, healer }, use) => {
    await use(new AttractionsHomePage(page, healer));
  },
});

export const expect = test.expect;
