import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';

/**
 * Single property (hotel) details page. Opened in a new tab from the
 * results list, so it is constructed with the popup Page instance and is
 * never `open()`-ed directly.
 */
export class PropertyPage extends BasePage {
  readonly path = '/hotel';
  readonly pageName = 'Property details page';

  private static readonly E = {
    propertyName: {
      key: 'stays.property.name',
      description: 'Property name heading',
      candidates: [
        '#hp_hotel_name',
        'h2[data-testid="title"]',
        'h2.pp-header__title',
        '[data-capla-component-boundary*="PropertyHeaderName"] h2',
      ],
    },
    availabilitySection: {
      key: 'stays.property.availability',
      description: 'Room availability table / booking section',
      candidates: ['#hprt-table', '[data-testid="rooms-table"]', '#availability'],
    },
  } satisfies Record<string, ElementDefinition>;

  async getPropertyName(): Promise<string> {
    const name = await this.el(PropertyPage.E.propertyName, { timeout: 30_000 });
    return (await name.textContent())?.trim() ?? '';
  }

  async hasAvailabilitySection(): Promise<boolean> {
    try {
      await this.el(PropertyPage.E.availabilitySection, { state: 'attached', timeout: 20_000 });
      return true;
    } catch {
      return false;
    }
  }
}
