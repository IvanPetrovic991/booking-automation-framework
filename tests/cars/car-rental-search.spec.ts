import { CAR_RENTAL_QUERIES } from '../../src/data/testData';
import { expect, test } from '../../src/fixtures/test';

test.describe('Car rental — search', () => {
  test(
    'airport pick-up search returns available vehicles',
    { tag: ['@cars', '@regression'] },
    async ({ carRentalHomePage }) => {
      const query = CAR_RENTAL_QUERIES.belgradeAirport;
      await carRentalHomePage.open();
      const results = await carRentalHomePage.searchCars(query);
      await results.waitForResults();

      expect(await results.getVehiclesCount()).toBeGreaterThan(0);
      // Correctness, not just presence: the results are for the requested
      // location and the heading reports an actual inventory count.
      expect(results.page.url()).toMatch(new RegExp(`locationName=[^&]*${query.pickupMatch}`, 'i'));
      expect(await results.getResultsHeading()).toMatch(/\d[\d,.]*\s+cars? available/i);
    },
  );
});
