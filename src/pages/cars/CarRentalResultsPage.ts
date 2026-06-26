import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';

/**
 * Car rental search results (served from the cars subdomain after the
 * search redirect). Vehicle inventory loads asynchronously — waits are
 * generous.
 */
export class CarRentalResultsPage extends BasePage {
  readonly path = '/cars/search-results';
  readonly pageName = 'Car rental search results';

  private static readonly E = {
    vehicleCards: {
      key: 'cars.results.vehicleCards',
      description: 'Vehicle offer cards (role=group wrapping the car model heading)',
      candidates: [
        'div[role="group"]:has(h2)',
        '[data-testid="vehicle-card"]',
        '[data-testid="search-result-card"]',
      ],
    },
    resultsHeading: {
      key: 'cars.results.heading',
      description: 'Results heading ("N cars available")',
      // Both candidates require the "available" text: a bare `main h1` would
      // also match loading/error/interstitial headings and poison the healer.
      candidates: ['h1:has-text("cars available")', 'main h1:has-text("available")'],
    },
  } satisfies Record<string, ElementDefinition>;

  /**
   * The cars backend occasionally answers a search with its own error page
   * ("Oops - something went wrong. Please refresh the page…") instead of
   * results. A plain locator, not a healed definition: it is a diagnostic
   * marker, and a "heal" between its variants would be noise.
   */
  private static readonly UPSTREAM_ERROR_PAGE = 'h1:has-text("something went wrong")';

  private static readonly RESULTS_BUDGET_MS = 90_000;

  async waitForResults(): Promise<void> {
    const cards = await this.withChallengeGuard(async () => {
      // Fail fast on the site's error page instead of spending the whole
      // heading budget on a page that will never render results: the failure
      // then names the real (upstream) cause rather than reading like a
      // selector problem, and the test-level retry re-runs the search — the
      // recovery the page itself suggests.
      const upstreamError = this.page
        .locator(CarRentalResultsPage.UPSTREAM_ERROR_PAGE)
        .first()
        .waitFor({ state: 'visible', timeout: CarRentalResultsPage.RESULTS_BUDGET_MS })
        .then(
          () => {
            throw new Error(
              `[${this.pageName}] the site returned its error page ("Oops - something went wrong") ` +
                'instead of results — an upstream failure, not a selector problem.',
            );
          },
          () => undefined, // No error page within the budget: the heading wait decides.
        );
      await Promise.race([
        this.el(CarRentalResultsPage.E.resultsHeading, {
          timeout: CarRentalResultsPage.RESULTS_BUDGET_MS,
        }),
        upstreamError,
      ]);
      // Collection lookup (many cards) — via all() so a healed multi-match
      // selector persists instead of being flagged ambiguous for a single lookup.
      return this.all(CarRentalResultsPage.E.vehicleCards, { timeout: 30_000 });
    });
    await cards.first().waitFor({ state: 'visible', timeout: BasePage.RESULT_SETTLE_MS });
  }

  async getResultsHeading(): Promise<string> {
    const heading = await this.el(CarRentalResultsPage.E.resultsHeading);
    return (await heading.textContent())?.trim() ?? '';
  }

  async getVehiclesCount(): Promise<number> {
    const cards = await this.all(CarRentalResultsPage.E.vehicleCards);
    return cards.count();
  }
}
