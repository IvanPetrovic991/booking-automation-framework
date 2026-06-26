import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';

/** Attractions listing for a destination. */
export class AttractionsResultsPage extends BasePage {
  readonly path = '/attractions/searchresults';
  readonly pageName = 'Attractions search results';

  private static readonly E = {
    attractionCards: {
      key: 'attractions.results.cards',
      description: 'Attraction cards in the listing',
      candidates: [
        '[data-testid="card"]',
        'a[data-testid="card-link"]',
        '[data-testid="sr-list"] article',
      ],
    },
    listingHeader: {
      key: 'attractions.results.header',
      description: 'Listing header naming the destination',
      candidates: ['h1', 'main h1', '[data-testid="pageHeader"]'],
    },
  } satisfies Record<string, ElementDefinition>;

  async waitForResults(): Promise<void> {
    // Collection lookup (many cards) — via all() so a healed multi-match
    // selector persists instead of being flagged ambiguous for a single lookup.
    const cards = await this.withChallengeGuard(() =>
      this.all(AttractionsResultsPage.E.attractionCards, { timeout: 60_000 }),
    );
    await cards.first().waitFor({ state: 'visible', timeout: BasePage.RESULT_SETTLE_MS });
  }

  async getAttractionsCount(): Promise<number> {
    const cards = await this.all(AttractionsResultsPage.E.attractionCards);
    return cards.count();
  }

  /** Header text — the destination check lives here, since the listing URL encodes the city as an opaque dest_id. */
  async getHeaderText(): Promise<string> {
    const header = await this.el(AttractionsResultsPage.E.listingHeader);
    return (await header.textContent())?.trim() ?? '';
  }
}
