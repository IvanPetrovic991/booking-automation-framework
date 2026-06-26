import { displayedDatePattern, futureDate } from '../../src/core/utils/dates';
import { FLIGHT_ROUTES } from '../../src/data/testData';
import { expect, test } from '../../src/fixtures/test';

test.describe('Flights — search', () => {
  test(
    'one-way European short-haul search returns flight offers',
    { tag: ['@flights', '@regression'] },
    async ({ flightsHomePage }) => {
      const route = FLIGHT_ROUTES.europeanShortHaul;
      const departureDate = futureDate(45);

      await flightsHomePage.open();
      const results = await flightsHomePage.searchOneWay(route, departureDate);
      await results.waitForResults();

      expect(await results.getOffersCount()).toBeGreaterThan(0);
      // Correctness is asserted on what the site RENDERED, not on the URL:
      // in the Kayak variant the framework builds the deep-link itself, so a
      // URL check there would only echo the test's own input. The first offer
      // must name the requested airports, the page must display the requested
      // departure date, and the offer must carry an actual amount.
      const firstOffer = await results.getFirstOfferText();
      expect(firstOffer, 'First offer should name the origin airport').toContain(route.fromQuery);
      expect(firstOffer, 'First offer should name the destination airport').toContain(
        route.toQuery,
      );
      const datePattern = displayedDatePattern(departureDate);
      expect(
        datePattern.test(await results.getVisibleText()),
        `Page should display the departure date ${departureDate} (${datePattern.source})`,
      ).toBe(true);
      expect(await results.getFirstOfferPrice()).toMatch(/\d/);
    },
  );
});
