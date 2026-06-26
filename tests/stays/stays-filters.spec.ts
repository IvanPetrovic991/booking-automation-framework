import { StaysQueryBuilder } from '../../src/data/builders/StaysQueryBuilder';
import { DESTINATIONS } from '../../src/data/testData';
import { expect, test } from '../../src/fixtures/test';

test.describe('Stays — filtering and sorting', () => {
  test(
    'results can be filtered by star rating and sorted by price',
    { tag: ['@stays', '@regression'] },
    async ({ staysResultsPage }) => {
      const query = new StaysQueryBuilder()
        .withDestination(DESTINATIONS.mediterranean)
        .withCheckInOffset(40)
        .withNights(3)
        .build();

      await staysResultsPage.openWith(query);
      await staysResultsPage.waitForResults();
      const unfilteredTotal = await staysResultsPage.getHeaderPropertyCount();
      expect(unfilteredTotal, 'Header should report the unfiltered total').toBeGreaterThan(0);

      // The filter must actually narrow the result set. The header carries the
      // site's own total (the card count is just the page size), so it has to
      // drop — and stay above zero. Polled: the header re-renders a moment
      // after the URL gains the filter parameter.
      await staysResultsPage.applyStarFilter(4);
      await expect
        .poll(() => staysResultsPage.getHeaderPropertyCount(), {
          message: `Star filter should narrow the ${unfilteredTotal} unfiltered properties`,
        })
        .toBeLessThan(unfilteredTotal);
      expect(await staysResultsPage.getHeaderPropertyCount()).toBeGreaterThan(0);

      // Sorting must actually reorder the list. Two oracles, both rendered by
      // the site: it has to report the price sort as active, and the cheapest
      // results have to move to the top. The headline prices are deliberately
      // NOT asserted to be strictly ascending — booking orders by its internal
      // rate (before discounts, taxes and rounding), so the displayed amounts
      // are only approximately ascending (observed: 496, 533, 530, 540, 469);
      // a strict check would fail on the site's own behavior, not on a bug.
      const pricesBefore = await staysResultsPage.getDisplayedPrices(5);
      await staysResultsPage.sortByPriceAscending();
      expect(await staysResultsPage.getActiveSortLabel()).toMatch(/price \(lowest first\)/i);
      const pricesAfter = await staysResultsPage.getDisplayedPrices(5);
      expect(pricesAfter.length, 'Expected readable prices on the sorted results').toBeGreaterThan(
        1,
      );
      expect(
        average(pricesAfter),
        `Sorted top prices (${pricesAfter.join(', ')}) should be cheaper on average than the unsorted ones (${pricesBefore.join(', ')})`,
      ).toBeLessThan(average(pricesBefore));
    },
  );
});

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
