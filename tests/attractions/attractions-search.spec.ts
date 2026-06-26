import { ATTRACTIONS_QUERIES } from '../../src/data/testData';
import { expect, test } from '../../src/fixtures/test';

test.describe('Attractions — search', () => {
  test(
    'destination search lists bookable attractions',
    { tag: ['@attractions', '@regression'] },
    async ({ attractionsHomePage }) => {
      const query = ATTRACTIONS_QUERIES.paris;
      await attractionsHomePage.open();
      const results = await attractionsHomePage.searchAttractions(query);
      await results.waitForResults();

      expect(await results.getAttractionsCount()).toBeGreaterThan(0);
      // Correctness: the listing names the searched destination. (The URL
      // cannot be asserted — it encodes the city as an opaque dest_id.)
      expect(await results.getHeaderText()).toContain(query.destination);
    },
  );
});
