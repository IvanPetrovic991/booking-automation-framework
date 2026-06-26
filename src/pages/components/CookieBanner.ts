import type { Page } from '@playwright/test';
import { logger } from '../../core/utils/logger';

/**
 * OneTrust cookie consent dialog shown on first visit across all
 * booking.com products. Best-effort: the banner may legitimately not
 * appear (already accepted in this context, region differences).
 */
export class CookieBanner {
  /**
   * All accept-button variants in one CSS selector list, so absence costs a
   * single short timeout instead of one full timeout per candidate.
   */
  private static readonly ACCEPT_SELECTOR = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept all")',
    '[data-testid="cookie-banner"] button',
  ].join(', ');

  constructor(private readonly page: Page) {}

  async acceptIfPresent(): Promise<void> {
    const button = this.page.locator(CookieBanner.ACCEPT_SELECTOR).first();
    try {
      await button.click({ timeout: 3_000 });
      logger.debug('Cookie banner accepted');
    } catch {
      // Not present — already accepted in this context or a regional variant.
    }
  }
}
