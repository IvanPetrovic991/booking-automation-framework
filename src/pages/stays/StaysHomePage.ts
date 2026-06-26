import { test, type Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';
import type { ElementDefinition } from '../../core/healing/types';
import type { StaysSearchQuery } from '../../data/types';
import { StaysResultsPage } from './StaysResultsPage';

/** Calendar day cells are keyed by date — volatile, so heals are not persisted. */
function calendarDay(date: string): ElementDefinition {
  return {
    key: 'stays.calendar.day',
    description: `Calendar day cell for ${date}`,
    volatile: true,
    candidates: [
      `[data-testid="searchbox-datepicker-calendar"] [data-date="${date}"]`,
      `[data-date="${date}"]`,
      `td[role="gridcell"]:has([data-date="${date}"])`,
    ],
  };
}

/**
 * booking.com home page = the Stays product search. Owns the main search
 * box: destination autocomplete, date picker and occupancy configuration.
 */
export class StaysHomePage extends BasePage {
  readonly path = '/';
  readonly pageName = 'Stays home page';

  private static readonly E = {
    destinationInput: {
      key: 'stays.searchbox.destinationInput',
      description: 'Destination ("Where are you going?") input',
      candidates: [
        'input[name="ss"]',
        '[data-testid="destination-container"] input',
        'input[placeholder*="Where are you going"]',
      ],
    },
    autocompleteOptions: {
      key: 'stays.searchbox.autocompleteOptions',
      description: 'Destination autocomplete result options',
      candidates: [
        '[data-testid="autocomplete-result"]',
        'li[id^="autocomplete-result"]',
        '[data-testid="autocomplete-results-options"] li',
      ],
    },
    datesContainer: {
      key: 'stays.searchbox.datesContainer',
      description: 'Check-in / check-out dates field',
      candidates: [
        '[data-testid="searchbox-dates-container"]',
        '[data-testid="date-display-field-start"]',
      ],
    },
    calendar: {
      key: 'stays.searchbox.calendar',
      description: 'Date picker calendar',
      candidates: [
        '[data-testid="searchbox-datepicker-calendar"]',
        '[data-testid="datepicker-tabs"]',
        '[data-testid="searchbox-datepicker"]',
      ],
    },
    calendarNext: {
      key: 'stays.searchbox.calendarNext',
      description: 'Calendar "next month" arrow',
      candidates: [
        '[data-testid="searchbox-datepicker-calendar"] button[aria-label*="Next"]',
        'button[aria-label="Next month"]',
      ],
    },
    occupancyButton: {
      key: 'stays.searchbox.occupancyButton',
      description: 'Occupancy (guests/rooms) configurator trigger',
      candidates: ['[data-testid="occupancy-config"]', 'button[data-testid*="occupancy"]'],
    },
    occupancyPopup: {
      key: 'stays.searchbox.occupancyPopup',
      description: 'Occupancy configurator popup',
      candidates: [
        '[data-testid="occupancy-popup"]',
        'div[role="dialog"]:has(#group_adults)',
        'div:has(> div > input#group_adults)',
      ],
    },
    occupancyDone: {
      key: 'stays.searchbox.occupancyDone',
      description: 'Occupancy popup Done button',
      candidates: [
        '[data-testid="occupancy-popup"] button:has-text("Done")',
        'button:has-text("Done")',
      ],
    },
    searchButton: {
      key: 'stays.searchbox.searchButton',
      description: 'Main Search submit button',
      candidates: [
        'button[type="submit"]:has-text("Search")',
        '[data-testid="searchbox-layout-wide"] button[type="submit"]',
        'button[type="submit"]',
      ],
    },
  } satisfies Record<string, ElementDefinition>;

  /**
   * The main search box (destination input) as a locator for web-first
   * assertions — a missing box fails with the healer's full selector list
   * instead of a bare `false`.
   */
  searchBox(): Promise<Locator> {
    return this.el(StaysHomePage.E.destinationInput, { timeout: 15_000 });
  }

  async searchStays(query: StaysSearchQuery): Promise<StaysResultsPage> {
    await test.step(`Search stays: ${query.destination} ${query.checkIn} → ${query.checkOut}`, async () => {
      await this.dismissOverlays();
      await this.fillDestination(query.destination);
      await this.selectDates(query.checkIn, query.checkOut);
      await this.setOccupancy(query);
      const searchButton = await this.el(StaysHomePage.E.searchButton);
      await searchButton.click();
      await this.page.waitForURL(/searchresults/, { timeout: 60_000 });
    });
    const results = new StaysResultsPage(this.page, this.healer);
    await results.dismissOverlays();
    return results;
  }

  private async fillDestination(destination: string): Promise<void> {
    const input = await this.el(StaysHomePage.E.destinationInput);
    await input.click();
    await input.fill(destination);
    const options = await this.all(StaysHomePage.E.autocompleteOptions);
    await this.clickSuggestion(options, destination);
  }

  private async selectDates(checkIn: string, checkOut: string): Promise<void> {
    await this.ensureCalendarOpen();
    await this.clickCalendarDay(checkIn);
    await this.clickCalendarDay(checkOut);
  }

  private async ensureCalendarOpen(): Promise<void> {
    try {
      await this.el(StaysHomePage.E.calendar, { timeout: 4_000 });
    } catch {
      const dates = await this.el(StaysHomePage.E.datesContainer);
      await dates.click();
      await this.el(StaysHomePage.E.calendar);
    }
  }

  /** Click a day cell, paging forward through months until it is rendered. */
  private async clickCalendarDay(date: string, maxMonthHops = 12): Promise<void> {
    for (let hop = 0; hop < maxMonthHops; hop++) {
      try {
        const day = await this.el(calendarDay(date), { timeout: 2_500 });
        await day.click();
        return;
      } catch {
        const next = await this.el(StaysHomePage.E.calendarNext, { timeout: 5_000 });
        await next.click();
      }
    }
    throw new Error(`Calendar day ${date} not reachable within ${maxMonthHops} month hops`);
  }

  private async setOccupancy(query: StaysSearchQuery): Promise<void> {
    const trigger = await this.el(StaysHomePage.E.occupancyButton);
    await trigger.click();
    const popup = await this.el(StaysHomePage.E.occupancyPopup);

    await this.setStepperValue(popup, '#group_adults', query.adults);
    await this.setStepperValue(popup, '#group_children', query.children);
    await this.setStepperValue(popup, '#no_rooms', query.rooms);

    const done = await this.el(StaysHomePage.E.occupancyDone, { timeout: 5_000 }).catch(() => null);
    if (done) await done.click();
  }

  /**
   * The occupancy rows are minus/plus steppers around a hidden input that
   * holds the current value. We resolve the innermost row that contains
   * both the input and buttons, then step toward the target value.
   * Throws when the target cannot be reached — a search must never run
   * silently with the wrong occupancy.
   */
  private async setStepperValue(
    popup: Locator,
    inputSelector: string,
    target: number,
  ): Promise<void> {
    const input = this.page.locator(inputSelector).first();
    const row = popup
      .locator('div:has(button)')
      .filter({ has: this.page.locator(inputSelector) })
      .last();
    const minus = row.getByRole('button').first();
    const plus = row.getByRole('button').last();

    const maxSteps = 20;
    for (let guard = 0; guard < maxSteps; guard++) {
      const raw = await input.inputValue();
      const current = Number.parseInt(raw, 10);
      if (Number.isNaN(current)) {
        throw new Error(`Occupancy stepper ${inputSelector}: unreadable current value "${raw}"`);
      }
      if (current === target) return;
      await (current < target ? plus : minus).click();
    }
    throw new Error(
      `Occupancy stepper ${inputSelector} did not reach ${target} within ${maxSteps} clicks`,
    );
  }
}
