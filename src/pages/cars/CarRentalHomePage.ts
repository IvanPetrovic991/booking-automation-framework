import { test } from '@playwright/test';
import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';
import type { CarRentalQuery } from '../../data/types';
import { CarRentalResultsPage } from './CarRentalResultsPage';

/**
 * booking.com Car rentals search (/cars/). Pick-up and drop-off dates are
 * pre-filled with sensible defaults, so the minimal happy path only needs
 * a pick-up location.
 */
export class CarRentalHomePage extends BasePage {
  readonly path = '/cars/';
  readonly pageName = 'Car rental home page';

  private static readonly E = {
    // Both primaries below were promoted from healed fallbacks (the documented
    // maintenance workflow): the previous aria-label / data-testid primaries
    // stopped matching in July 2026 and are kept as fallbacks.
    pickupInput: {
      key: 'cars.search.pickupInput',
      description: 'Pick-up location input',
      candidates: [
        'role=combobox[name="Pick-up location"]',
        'input[aria-label="Pick-up location"]',
        'input[placeholder*="Pick-up location"]',
        '[data-testid="searchbox-live"] input',
      ],
    },
    autocompleteOptions: {
      key: 'cars.search.autocompleteOptions',
      description: 'Pick-up location autocomplete options',
      candidates: ['[role="option"]', '[data-testid="list-item"]', 'ul[role="listbox"] li'],
    },
    searchButton: {
      key: 'cars.search.searchButton',
      description: 'Car rental search submit button',
      candidates: [
        'button[type="submit"]:has-text("Search")',
        '[data-testid="searchbox"] button[type="submit"]',
        'button[type="submit"]',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  async searchCars(query: CarRentalQuery): Promise<CarRentalResultsPage> {
    await test.step(`Search car rental at "${query.pickupLocation}"`, async () => {
      await this.dismissOverlays();
      const input = await this.el(CarRentalHomePage.E.pickupInput);
      await input.click();
      await input.fill(query.pickupLocation);

      const options = await this.all(CarRentalHomePage.E.autocompleteOptions);
      await this.clickSuggestion(options, query.pickupMatch);

      const search = await this.el(CarRentalHomePage.E.searchButton);
      await search.click();
      await this.page.waitForLoadState('domcontentloaded');
    });
    const results = new CarRentalResultsPage(this.page, this.healer);
    await results.dismissOverlays();
    return results;
  }
}
