import type { Page } from '@playwright/test';
import { logger } from '../../core/utils/logger';

/**
 * The "Sign in, save money" modal that booking.com shows at unpredictable
 * moments after landing. Handled with Playwright's addLocatorHandler — the
 * modern mechanism for interrupting overlays: Playwright dismisses the
 * popup automatically whenever it blocks an action, with zero polling in
 * test code.
 */
export class SignInPopup {
  private static readonly DISMISS_SELECTOR = [
    'button[aria-label="Dismiss sign-in info."]',
    'div[role="dialog"] button[aria-label*="Dismiss"]',
  ].join(', ');

  /** Pages that already have the handler installed. */
  private static readonly handledPages = new WeakSet<Page>();

  constructor(private readonly page: Page) {}

  async registerAutoDismiss(): Promise<void> {
    if (SignInPopup.handledPages.has(this.page)) return;
    SignInPopup.handledPages.add(this.page);

    const dismissButton = this.page.locator(SignInPopup.DISMISS_SELECTOR).first();
    await this.page.addLocatorHandler(
      dismissButton,
      async () => {
        try {
          await dismissButton.click({ timeout: 5_000 });
          logger.debug('Sign-in popup auto-dismissed via locator handler');
        } catch {
          // Popup vanished on its own or the test is ending — never fail
          // a test from inside the overlay handler.
        }
      },
      { times: 5 },
    );
  }
}
