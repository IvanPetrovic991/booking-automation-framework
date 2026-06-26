import { test } from '@playwright/test';
import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';
import type { AttractionsQuery } from '../../data/types';
import { AttractionsResultsPage } from './AttractionsResultsPage';

/**
 * booking.com Attractions search (/attractions/). Selecting a destination
 * from the autocomplete navigates straight to that city's attractions
 * listing — there is no separate submit step in the happy path.
 */
export class AttractionsHomePage extends BasePage {
  readonly path = '/attractions/';
  readonly pageName = 'Attractions home page';

  private static readonly E = {
    searchInput: {
      key: 'attractions.search.input',
      description: 'Attractions destination search input',
      candidates: [
        'input[name="query"]',
        '[data-testid="search-input-field"]',
        'input[placeholder*="Where"]',
      ],
    },
    destinationLinks: {
      key: 'attractions.search.destinationLinks',
      description: 'Destination suggestion links (navigate straight to the listing)',
      candidates: [
        'a[href*="/attractions/searchresults"]',
        '[data-testid="search-bar-result"]',
        'ul[role="listbox"] li',
      ],
    },
    searchButton: {
      key: 'attractions.search.searchButton',
      description: 'Attractions search submit button',
      candidates: [
        'button[type="submit"]:has-text("Search")',
        'button:has-text("Search")',
        '[data-testid="search-button"]',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  async searchAttractions(query: AttractionsQuery): Promise<AttractionsResultsPage> {
    await test.step(`Search attractions in "${query.destination}"`, async () => {
      await this.dismissOverlays();
      const input = await this.el(AttractionsHomePage.E.searchInput);
      await input.click();
      await input.fill(query.destination);

      // Destination suggestions are links straight to the listing page.
      const options = await this.all(AttractionsHomePage.E.destinationLinks);
      await this.clickSuggestion(options, query.destinationMatch);

      try {
        await this.page.waitForURL(/attractions\/searchresults/, { timeout: 10_000 });
      } catch {
        // Variant where the suggestion only fills the field: close the date
        // picker overlay and submit explicitly.
        await this.page.keyboard.press('Escape');
        const search = await this.el(AttractionsHomePage.E.searchButton);
        await search.click({ force: true });
        await this.page.waitForURL(/attractions\/searchresults/, { timeout: 30_000 });
      }
    });
    const results = new AttractionsResultsPage(this.page, this.healer);
    await results.dismissOverlays();
    return results;
  }
}
