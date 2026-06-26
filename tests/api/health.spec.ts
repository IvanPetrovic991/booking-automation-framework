import { expect, test } from '@playwright/test';

/**
 * API-level checks using Playwright's request fixture (APIRequestContext) —
 * no browser involved, which is why this spec imports the base `test` rather
 * than the project fixtures: those carry auto fixtures bound to `page` and
 * `context`, and would launch a browser for every API test. This is the place
 * to grow contract/API coverage; for the public booking.com site we keep fast
 * availability checks that make great CI canaries: if these fail, every UI
 * failure is suspect.
 */
test.describe('API — site availability', () => {
  test(
    'home page responds successfully over plain HTTP',
    { tag: ['@api', '@smoke'] },
    async ({ request }) => {
      const response = await request.get('/', {
        headers: { 'accept-language': 'en-US' },
      });

      // Check for a bot challenge FIRST — raw APIRequestContext calls (no
      // browser fingerprint) attract them more than UI tests do, and the
      // interstitial can be served with any status (2xx via soft-block, but
      // also 403/429/503). It is an environment condition, not an
      // availability failure, so skip rather than fail on either signal.
      const body = await response.text();
      test.skip(
        /reportChallengeError|px-captcha|challenge-form/i.test(body),
        `booking.com served a bot challenge to the plain-HTTP request (status ${response.status()})`,
      );

      expect(response.status(), `Unexpected status from ${response.url()}`).toBeLessThan(400);
      expect(response.headers()['content-type'] ?? '').toContain('text/html');
      // Whatever remains must be real product markup, not a CDN error page.
      expect(body).toContain('Booking.com');
    },
  );

  test(
    'robots.txt is served and allows crawling metadata',
    { tag: ['@api', '@regression'] },
    async ({ request }) => {
      const response = await request.get('/robots.txt');
      expect(response.ok()).toBe(true);
      const body = await response.text();
      expect(body).toContain('User-agent');
    },
  );
});
