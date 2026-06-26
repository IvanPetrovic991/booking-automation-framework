import { test } from '@playwright/test';
import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';
import type { FlightRoute } from '../../data/types';
import { FlightsResultsPage } from './FlightsResultsPage';

function flightsCalendarDay(date: string): ElementDefinition {
  return {
    key: 'flights.calendar.day',
    description: `Flights calendar day cell for ${date}`,
    volatile: true,
    candidates: [
      `[data-ui-name="calendar_body"] [data-date="${date}"]`,
      `span[data-date="${date}"]`,
      `[data-date="${date}"]`,
    ],
  };
}

/**
 * booking.com Flights search (/flights/). The flights product uses
 * `data-ui-name` attributes instead of `data-testid` — primaries target
 * those, with structural fallbacks for the healer.
 */
export class FlightsHomePage extends BasePage {
  readonly path = '/flights/';
  readonly pageName = 'Flights home page';

  /**
   * Direct navigation to /flights/ gets redirected back to the stays home
   * page, so the flights product is entered like a real user: home page →
   * Flights tab in the global header.
   *
   * Depending on region, booking.com serves flights either natively
   * (booking.com/flights, data-ui-name DOM) or as a Kayak white-label
   * (booking.kayak.com). searchOneWay() dispatches per variant.
   */
  override async open(): Promise<this> {
    await test.step(`Open ${this.pageName} via header tab`, async () => {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
      await this.dismissOverlays();
      const tab = await this.el(FlightsHomePage.E.flightsHeaderTab);
      await tab.click();
      await this.page.waitForURL(/flights|kayak/, { timeout: 30_000 });
      // A native /flights/ page can still client-side redirect to the Kayak
      // white-label. Settle the variant before anyone reads the URL: either
      // the native search form becomes interactive or the redirect lands.
      if (!this.isKayakVariant()) {
        await Promise.race([
          this.page.waitForURL(/kayak/, { timeout: 15_000 }).catch(() => undefined),
          this.el(FlightsHomePage.E.fromField, { timeout: 15_000 }).then(
            () => undefined,
            () => undefined,
          ),
        ]);
      }
      await this.dismissOverlays();
    });
    return this;
  }

  private isKayakVariant(): boolean {
    return this.page.url().includes('kayak');
  }

  private static readonly E = {
    flightsHeaderTab: {
      key: 'flights.nav.headerTab',
      description: 'Flights tab in the global header',
      candidates: ['a#flights', 'role=menuitem[name="Flights"]', 'header a[href*="flights"]'],
    },
    oneWayTripType: {
      key: 'flights.search.tripTypeOneWay',
      description: 'One-way trip type radio',
      candidates: [
        'label:has(input[value="ONEWAY"])',
        '[data-ui-name="trip_type_ONEWAY"]',
        'label:has-text("One-way")',
      ],
    },
    fromField: {
      key: 'flights.search.fromField',
      description: 'Origin ("Where from?") field trigger',
      candidates: [
        '[data-ui-name="input_location_from_segment_0"]',
        'button[aria-label*="Flight origin"]',
        '[data-ui-name*="location_from"]',
      ],
    },
    toField: {
      key: 'flights.search.toField',
      description: 'Destination ("Where to?") field trigger',
      candidates: [
        '[data-ui-name="input_location_to_segment_0"]',
        'button[aria-label*="Flight destination"]',
        '[data-ui-name*="location_to"]',
      ],
    },
    locationInput: {
      key: 'flights.search.locationInput',
      description: 'Active location autocomplete text input',
      candidates: [
        'input[data-ui-name="input_text_autocomplete"]',
        'div[role="dialog"] input[type="text"]',
        'input[placeholder*="Where"]',
      ],
    },
    autocompleteOptions: {
      key: 'flights.search.autocompleteOptions',
      description: 'Location autocomplete options',
      candidates: [
        '[data-ui-name^="locations_autocomplete_option"]',
        'ul[role="listbox"] li',
        '[role="option"]',
      ],
    },
    dateField: {
      key: 'flights.search.dateField',
      description: 'Departure date field trigger',
      candidates: [
        '[data-ui-name="button_date_segment_0"]',
        'button[data-ui-name*="date"]',
        '[data-testid="searchbox_dates"]',
      ],
    },
    calendar: {
      key: 'flights.search.calendar',
      description: 'Flights date picker calendar',
      candidates: [
        '[data-ui-name="calendar_body"]',
        '[data-ui-name="calendar"]',
        'div[role="dialog"]:has([data-date])',
      ],
    },
    calendarNext: {
      key: 'flights.search.calendarNext',
      description: 'Flights calendar next month arrow',
      candidates: ['button[data-ui-name="calendar_control_next"]', 'button[aria-label*="Next"]'],
    },
    searchButton: {
      key: 'flights.search.searchButton',
      description: 'Flights search submit button',
      candidates: [
        'button[data-ui-name="button_search_submit"]',
        'button[type="submit"]:has-text("Search")',
        'button:has-text("Search")',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  async searchOneWay(route: FlightRoute, departureDate: string): Promise<FlightsResultsPage> {
    if (this.isKayakVariant()) {
      return this.searchOneWayKayak(route, departureDate);
    }
    return this.searchOneWayNative(route, departureDate);
  }

  /**
   * Kayak white-label exposes a stable deep-link URL scheme:
   * /flights/{FROM}-{TO}/{YYYY-MM-DD}. More reliable than driving the
   * widget UI, which Kayak A/B-tests heavily.
   */
  private async searchOneWayKayak(
    route: FlightRoute,
    departureDate: string,
  ): Promise<FlightsResultsPage> {
    await test.step(`Search one-way flight (Kayak variant) ${route.fromQuery} → ${route.toQuery} on ${departureDate}`, async () => {
      const origin = new URL(this.page.url()).origin;
      await this.page.goto(
        `${origin}/flights/${route.fromQuery}-${route.toQuery}/${departureDate}?sort=bestflight_a`,
        { waitUntil: 'domcontentloaded' },
      );
      await this.dismissOverlays();
    });
    return new FlightsResultsPage(this.page, this.healer);
  }

  private async searchOneWayNative(
    route: FlightRoute,
    departureDate: string,
  ): Promise<FlightsResultsPage> {
    await test.step(`Search one-way flight ${route.fromQuery} → ${route.toQuery} on ${departureDate}`, async () => {
      await this.dismissOverlays();
      const oneWay = await this.el(FlightsHomePage.E.oneWayTripType);
      await oneWay.click();

      await this.fillLocation(FlightsHomePage.E.fromField, route.fromQuery, route.fromMatch);
      await this.fillLocation(FlightsHomePage.E.toField, route.toQuery, route.toMatch);
      await this.selectDepartureDate(departureDate);

      const search = await this.el(FlightsHomePage.E.searchButton);
      await search.click();
      await this.page.waitForLoadState('domcontentloaded');
    });
    return new FlightsResultsPage(this.page, this.healer);
  }

  private async fillLocation(
    fieldDefinition: ElementDefinition,
    query: string,
    expectedMatch: string,
  ): Promise<void> {
    const field = await this.el(fieldDefinition);
    await field.click();
    const input = await this.el(FlightsHomePage.E.locationInput);
    await input.fill(query);
    const options = await this.all(FlightsHomePage.E.autocompleteOptions);
    await this.clickSuggestion(options, expectedMatch);
  }

  private async selectDepartureDate(date: string, maxMonthHops = 12): Promise<void> {
    // The calendar usually opens automatically after picking the destination;
    // open it explicitly if it did not.
    try {
      await this.el(FlightsHomePage.E.calendar, { timeout: 4_000 });
    } catch {
      const dateField = await this.el(FlightsHomePage.E.dateField);
      await dateField.click();
      await this.el(FlightsHomePage.E.calendar);
    }

    for (let hop = 0; hop < maxMonthHops; hop++) {
      try {
        const day = await this.el(flightsCalendarDay(date), { timeout: 2_500 });
        await day.click();
        return;
      } catch {
        const next = await this.el(FlightsHomePage.E.calendarNext, { timeout: 5_000 });
        await next.click();
      }
    }
    throw new Error(`Flights calendar day ${date} not reachable within ${maxMonthHops} month hops`);
  }
}
