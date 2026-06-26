import { test } from '@playwright/test';
import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';
import { withRetry } from '../../core/utils/retry';
import type { StaysSearchQuery } from '../../data/types';
import { PropertyPage } from './PropertyPage';

/**
 * Filters and sorting update the results in place (history.pushState + XHR):
 * the URL gaining the parameter is the reliable "applied" signal. The window
 * is per attempt — see {@link StaysResultsPage.applyInPlace}.
 */
const IN_PLACE_UPDATE_MS = 10_000;

/** Star-class filter checkboxes are keyed by the star count — volatile. */
function starFilter(stars: number): ElementDefinition {
  return {
    key: 'stays.results.starFilter',
    description: `${stars}-star property class filter`,
    volatile: true,
    candidates: [
      `[data-filters-item="class:class=${stars}"]`,
      `input[name="class=${stars}"]`,
      `[data-filters-group="class"] div:has-text("${stars} stars") input[type="checkbox"]`,
    ],
  };
}

/**
 * Stays search results (searchresults.html). Supports both UI-driven entry
 * (via StaysHomePage.searchStays) and deep-link entry (openWith) — deep
 * links keep filter/sort tests independent from search-box flakiness.
 */
export class StaysResultsPage extends BasePage {
  readonly path = '/searchresults.html';
  readonly pageName = 'Stays search results';

  private static readonly E = {
    propertyCards: {
      key: 'stays.results.propertyCards',
      description: 'Property result cards',
      candidates: [
        '[data-testid="property-card"]',
        '[data-testid="property-card-container"]',
        'div[data-testid*="property"]',
      ],
    },
    cardTitle: {
      key: 'stays.results.cardTitle',
      description: 'Property card title',
      candidates: ['[data-testid="property-card"] [data-testid="title"]', '[data-testid="title"]'],
    },
    resultsHeader: {
      key: 'stays.results.header',
      description: 'Results header ("<City>: N properties found")',
      candidates: ['h1[aria-live="assertive"]', '[data-component="arp-header"] h1', 'h1'],
    },
    sortTrigger: {
      key: 'stays.results.sortTrigger',
      description: 'Sorters dropdown trigger',
      candidates: [
        '[data-testid="sorters-dropdown-trigger"]',
        'button[data-testid*="sorters"]',
        'button:has-text("Sort by")',
      ],
    },
    sortOptionPriceAsc: {
      key: 'stays.results.sortOptionPriceAsc',
      description: 'Sort option: price, lowest first',
      candidates: [
        '[data-testid="sorters-dropdown"] button:has-text("Price (lowest first)")',
        '[aria-label="Price (lowest first)"]',
        'button:has-text("Price (lowest first)")',
      ],
    },
    cardPrice: {
      key: 'stays.results.cardPrice',
      description: 'Property card price',
      candidates: [
        '[data-testid="price-and-discounted-price"]',
        '[data-testid="property-card"] [data-testid*="price"]',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  /** Deep-link straight to results, bypassing the search box UI. */
  async openWith(query: StaysSearchQuery): Promise<this> {
    const params = new URLSearchParams({
      ss: query.destination,
      checkin: query.checkIn,
      checkout: query.checkOut,
      group_adults: String(query.adults),
      group_children: String(query.children),
      no_rooms: String(query.rooms),
    });
    await test.step(`Open stays results deep-link for ${query.destination}`, async () => {
      await this.page.goto(`${this.path}?${params.toString()}`, { waitUntil: 'domcontentloaded' });
      await this.dismissOverlays();
    });
    return this;
  }

  async waitForResults(): Promise<void> {
    // Collection lookup (many cards) — via all() so a healed multi-match
    // selector persists instead of being flagged ambiguous for a single lookup.
    const cards = await this.withChallengeGuard(() =>
      this.all(StaysResultsPage.E.propertyCards, { timeout: 45_000 }),
    );
    await cards.first().waitFor({ state: 'visible', timeout: BasePage.RESULT_SETTLE_MS });
  }

  async getResultsCount(): Promise<number> {
    const cards = await this.all(StaysResultsPage.E.propertyCards);
    return cards.count();
  }

  async getHeaderText(): Promise<string> {
    const header = await this.el(StaysResultsPage.E.resultsHeader);
    return (await header.textContent())?.trim() ?? '';
  }

  /**
   * The sort the site reports as active, read from the sorters trigger
   * ("Sort by: Price (lowest first)") — rendered state, not a URL echo.
   */
  async getActiveSortLabel(): Promise<string> {
    const trigger = await this.el(StaysResultsPage.E.sortTrigger);
    return ((await trigger.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * The site's own total from the header ("Barcelona: 1,333 properties found")
   * — unlike the card count, which is just the page size, this number moves
   * when a filter applies. NaN when the header carries no count.
   */
  async getHeaderPropertyCount(): Promise<number> {
    const match = /(\d[\d.,]*)\+?\s+propert/i.exec(await this.getHeaderText());
    return match?.[1] ? Number.parseInt(match[1].replace(/[^\d]/g, ''), 10) : Number.NaN;
  }

  async getCardTitles(limit = 5): Promise<string[]> {
    const titles = await this.all(StaysResultsPage.E.cardTitle);
    const count = Math.min(await titles.count(), limit);
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(((await titles.nth(i).textContent()) ?? '').trim());
    }
    return result;
  }

  async sortByPriceAscending(): Promise<void> {
    await test.step('Sort results by price (lowest first)', async () => {
      await this.applyInPlace(/order=price/, 'price sort', async () => {
        // A previous attempt may have left the sorters menu open — reuse it
        // rather than toggling it shut with a second trigger click.
        const alreadyOpen = await this.el(StaysResultsPage.E.sortOptionPriceAsc, {
          timeout: 1_500,
        }).catch(() => null);
        if (!alreadyOpen) {
          const trigger = await this.el(StaysResultsPage.E.sortTrigger);
          await trigger.click();
        }
        const option = await this.el(StaysResultsPage.E.sortOptionPriceAsc);
        await option.click();
      });
    });
  }

  async applyStarFilter(stars: number): Promise<void> {
    await test.step(`Apply ${stars}-star filter`, async () => {
      await this.applyInPlace(
        new RegExp(`nflt=[^&]*class%3D${stars}`),
        `${stars}-star filter`,
        async () => {
          const checkbox = await this.el(starFilter(stars), { state: 'attached' });
          await checkbox.click();
        },
      );
    });
  }

  /**
   * Perform an in-place results update (filter, sort) and wait for it to land
   * in the URL. The "sign in, save money" popup can appear in the few
   * milliseconds between Playwright's actionability check and the click
   * itself and swallow it; the locator handler only runs before actions, not
   * while the URL is awaited. So the action is retried — but only while the
   * URL still lacks the parameter, so a slow-but-successful first click is
   * never toggled back off by a second one.
   */
  private async applyInPlace(
    applied: RegExp,
    description: string,
    action: () => Promise<void>,
  ): Promise<void> {
    await withRetry(
      async () => {
        if (!applied.test(this.page.url())) await action();
        await this.page.waitForURL(applied, { timeout: IN_PLACE_UPDATE_MS });
      },
      { attempts: 3, description: `${description} applied in URL` },
    );
    await this.waitForResults();
  }

  /**
   * Numeric value of the headline price of each of the first `limit` cards,
   * in on-page order — the raw material for sort-order assertions.
   *
   * Strictly one price per card: some regional variants render several
   * price-like elements inside a card (nightly rate plus the stay total), and
   * a flat page-wide list would interleave them — the first card's total read
   * as the second card's rate, which is exactly how "107, 321, 124" looks like
   * a broken sort.
   */
  async getDisplayedPrices(limit = 5): Promise<number[]> {
    const cards = await this.all(StaysResultsPage.E.propertyCards);
    const prices = await this.all(StaysResultsPage.E.cardPrice);
    const count = Math.min(await cards.count(), limit);
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await cards.nth(i).locator(prices).first().textContent()) ?? '';
      const numeric = Number.parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!Number.isNaN(numeric)) values.push(numeric);
    }
    return values;
  }

  /** Open the n-th property card; booking opens property pages in a new tab. */
  async openProperty(index = 0): Promise<PropertyPage> {
    const cards = await this.all(StaysResultsPage.E.propertyCards);
    const link = cards.nth(index).locator('a').first();
    const [propertyTab] = await Promise.all([
      this.page.context().waitForEvent('page', { timeout: 30_000 }),
      link.click(),
    ]);
    await propertyTab.waitForLoadState('domcontentloaded');
    const propertyPage = new PropertyPage(propertyTab);
    await propertyPage.dismissOverlays();
    return propertyPage;
  }
}
