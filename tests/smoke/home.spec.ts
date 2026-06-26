import { expect, test } from '../../src/fixtures/test';

test.describe('Booking.com — global shell', () => {
  test(
    'home page loads with the main stays search box',
    { tag: ['@smoke'] },
    async ({ staysHomePage }) => {
      await staysHomePage.open();
      await expect(staysHomePage.page).toHaveTitle(/booking\.com/i);
      await expect(await staysHomePage.searchBox()).toBeVisible();
    },
  );

  test(
    'header exposes all product tabs (stays, flights, cars, attractions)',
    { tag: ['@smoke'] },
    async ({ staysHomePage, headerNav }) => {
      await staysHomePage.open();
      // Soft: one missing tab must not hide the state of the other three.
      await expect.soft(await headerNav.tab('stays'), 'Stays tab').toBeVisible();
      await expect.soft(await headerNav.tab('flights'), 'Flights tab').toBeVisible();
      await expect.soft(await headerNav.tab('cars'), 'Car rentals tab').toBeVisible();
      await expect.soft(await headerNav.tab('attractions'), 'Attractions tab').toBeVisible();
    },
  );
});
