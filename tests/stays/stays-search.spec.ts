import { StaysQueryBuilder } from '../../src/data/builders/StaysQueryBuilder';
import { DESTINATIONS } from '../../src/data/testData';
import { expect, test } from '../../src/fixtures/test';

test.describe('Stays — search', () => {
  test(
    'searching a destination returns relevant properties',
    { tag: ['@stays', '@regression'] },
    async ({ staysHomePage }) => {
      const query = new StaysQueryBuilder()
        .withDestination(DESTINATIONS.capital)
        .withCheckInOffset(30)
        .withNights(3)
        .withAdults(2)
        .withRooms(1)
        .build();

      await staysHomePage.open();
      const results = await staysHomePage.searchStays(query);
      await results.waitForResults();

      expect(await results.getResultsCount()).toBeGreaterThan(0);
      expect(await results.getHeaderText()).toContain(query.destination);

      const titles = await results.getCardTitles(3);
      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) {
        expect(title.length).toBeGreaterThan(0);
      }
    },
  );

  test(
    'opening a property from results shows its details page',
    { tag: ['@stays', '@regression'] },
    async ({ staysResultsPage }) => {
      const query = new StaysQueryBuilder()
        .withDestination(DESTINATIONS.cityBreak)
        .withCheckInOffset(45)
        .withNights(2)
        .build();

      await staysResultsPage.openWith(query);
      await staysResultsPage.waitForResults();
      const [expectedTitle = ''] = await staysResultsPage.getCardTitles(1);
      expect(expectedTitle.length).toBeGreaterThan(0);

      // The new tab must be a property page for THE card that was clicked —
      // not just any page with a heading.
      const propertyPage = await staysResultsPage.openProperty(0);
      await expect(propertyPage.page).toHaveURL(/\/hotel\//);
      const name = (await propertyPage.getPropertyName()).replace(/\s+/g, ' ');
      expect(name.toLowerCase(), `Property page should be for "${expectedTitle}"`).toContain(
        expectedTitle.toLowerCase().slice(0, 20),
      );
    },
  );
});
