import type { Locator, Page } from '@playwright/test';
import { healingStore } from '../../core/healing/HealingStore';
import { SelfHealingLocator } from '../../core/healing/SelfHealingLocator';
import type { ElementDefinition } from '../../core/healing/types';

/**
 * Cross-product header navigation (Stays / Flights / Car rentals /
 * Attractions tabs). Used by smoke tests to verify the global shell and by
 * page objects to hop between products like a real user.
 */
export class HeaderNav {
  private static readonly E = {
    staysTab: {
      key: 'header.tab.stays',
      description: 'Stays (accommodations) tab in the global header',
      candidates: [
        'a#accommodations',
        '[data-testid="header-xpb"] a[href*="index"]',
        'header a:has-text("Stays")',
      ],
    },
    flightsTab: {
      key: 'header.tab.flights',
      description: 'Flights tab in the global header',
      candidates: [
        'a#flights',
        '[data-testid="header-xpb"] a[href*="flights"]',
        'header a:has-text("Flights")',
      ],
    },
    carsTab: {
      key: 'header.tab.cars',
      description: 'Car rentals tab in the global header',
      candidates: [
        'a#cars',
        '[data-testid="header-xpb"] a[href*="cars"]',
        'header a:has-text("Car rental")',
      ],
    },
    attractionsTab: {
      key: 'header.tab.attractions',
      description: 'Attractions tab in the global header',
      candidates: [
        'a#attractions',
        '[data-testid="header-xpb"] a[href*="attractions"]',
        'header a:has-text("Attractions")',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  private readonly healer: SelfHealingLocator;

  constructor(
    private readonly page: Page,
    healer?: SelfHealingLocator,
  ) {
    this.healer = healer ?? new SelfHealingLocator(page, healingStore);
  }

  /**
   * The resolved tab locator, for web-first assertions in specs
   * (`await expect(await headerNav.tab('stays')).toBeVisible()`). Returning the
   * locator instead of a boolean keeps the healer's diagnostic (every tried
   * selector) in the report when a tab is missing.
   */
  tab(tab: 'stays' | 'flights' | 'cars' | 'attractions'): Promise<Locator> {
    return this.healer.locate(HeaderNav.E[`${tab}Tab`], { timeout: 10_000 });
  }

  async openTab(tab: 'stays' | 'flights' | 'cars' | 'attractions'): Promise<void> {
    const definition = HeaderNav.E[`${tab}Tab`];
    const locator = await this.healer.locate(definition);
    await locator.click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
