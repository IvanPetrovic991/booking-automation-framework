import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';

/**
 * Flights search results. The flight search itself can take 20–40s on the
 * backend, so result waits are deliberately generous.
 */
export class FlightsResultsPage extends BasePage {
  readonly path = '/flights/';
  readonly pageName = 'Flights search results';

  private static readonly E = {
    flightCards: {
      key: 'flights.results.flightCards',
      description: 'Flight offer cards (native booking.com or Kayak white-label)',
      candidates: [
        '[data-testid="searchresults_card"]',
        '[data-ui-name="flight_card"]',
        '[aria-label^="Result item"]',
        'div[data-resultid]',
      ],
    },
    cardPrice: {
      key: 'flights.results.cardPrice',
      description: 'Flight offer price (native or Kayak variant)',
      candidates: [
        '[data-testid="flight_card_price_main_price"]',
        '[data-testid="searchresults_card"] [class*="price"]',
        '[aria-label^="Result item"] a[href*="/book/flight"]',
        'div[data-resultid] [class*="price-text"]',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  async waitForResults(): Promise<void> {
    // Card presence is a collection lookup (many cards) — resolve via all() so
    // a healed multi-match selector persists instead of being flagged ambiguous.
    // all() already blocks (up to its budget) until a visible card exists and
    // returns a visible-filtered locator, so the re-confirmation below only
    // needs a short residual window — never a second full budget that could
    // push the pair past the test timeout and mask the healer's error.
    // Kayak often redirects the deep-link to /security/check a moment after
    // navigation — the guard turns that into a skip, not a healer failure.
    const cards = await this.withChallengeGuard(() =>
      this.all(FlightsResultsPage.E.flightCards, { timeout: 90_000 }),
    );
    await cards.first().waitFor({ state: 'visible', timeout: BasePage.RESULT_SETTLE_MS });
  }

  async getOffersCount(): Promise<number> {
    const cards = await this.all(FlightsResultsPage.E.flightCards);
    return cards.count();
  }

  /** Text of the first offer card — both variants render the IATA codes in it. */
  async getFirstOfferText(): Promise<string> {
    const cards = await this.all(FlightsResultsPage.E.flightCards);
    return ((await cards.first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async getFirstOfferPrice(): Promise<string> {
    const prices = await this.all(FlightsResultsPage.E.cardPrice);
    return (await prices.first().textContent())?.trim() ?? '';
  }

  /**
   * Everything currently rendered on the page, whitespace-normalized. The
   * search summary (route, date) sits in variant-specific markup — Kayak's
   * search bar vs. booking's search box — so specs assert on the visible text
   * rather than on a selector that only one variant has.
   */
  async getVisibleText(): Promise<string> {
    return (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
  }
}
