import { test, type Locator, type Page } from '@playwright/test';
import { healingStore } from './healing/HealingStore';
import { SelfHealingLocator } from './healing/SelfHealingLocator';
import type { ElementDefinition, LocateOptions } from './healing/types';
import { logger } from './utils/logger';
import { CookieBanner } from '../pages/components/CookieBanner';
import { SignInPopup } from '../pages/components/SignInPopup';

/**
 * Base class for every page object. Provides:
 *  - the self-healing locator entry point ({@link el} / {@link all})
 *  - standard navigation with overlay dismissal (cookies, sign-in popup)
 *  - small shared helpers (safeClick)
 */
export abstract class BasePage {
  /**
   * Short re-confirmation window for "results are visible" checks. The primary
   * wait (`all()` with its own generous budget) already blocks until a visible
   * match exists; this is only a residual settle window, kept small so two
   * stacked waits can never sum past the test timeout and mask the healer's
   * descriptive error with a generic timeout.
   */
  protected static readonly RESULT_SETTLE_MS = 10_000;

  readonly page: Page;
  protected readonly healer: SelfHealingLocator;

  /** Path relative to baseURL, e.g. `/flights/`. */
  abstract readonly path: string;
  /** Human-readable name used in test.step titles and logs. */
  abstract readonly pageName: string;

  constructor(page: Page, healer?: SelfHealingLocator) {
    this.page = page;
    this.healer = healer ?? new SelfHealingLocator(page, healingStore);
  }

  async open(): Promise<this> {
    await test.step(`Open ${this.pageName}`, async () => {
      await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
      await this.dismissOverlays();
    });
    return this;
  }

  /** Resolve a single element through the self-healing engine. */
  protected el(definition: ElementDefinition, options?: LocateOptions): Promise<Locator> {
    return this.healer.locate(definition, options);
  }

  /** Resolve a collection of elements through the self-healing engine. */
  protected all(definition: ElementDefinition, options?: LocateOptions): Promise<Locator> {
    return this.healer.locateAll(definition, options);
  }

  /**
   * Booking.com shows a cookie consent dialog and (often) a "sign in to
   * save money" popup. The cookie banner is accepted once; the sign-in
   * popup appears at unpredictable moments, so it is wired to
   * page.addLocatorHandler and dismissed automatically whenever it would
   * block an action.
   */
  async dismissOverlays(): Promise<void> {
    await this.skipIfBotChallenged();
    await new SignInPopup(this.page).registerAutoDismiss();
    await new CookieBanner(this.page).acceptIfPresent();
  }

  /** DOM markers of bot-protection interstitials (PerimeterX / AWS WAF / generic). */
  private static readonly BOT_CHALLENGE_MARKERS = [
    '#px-captcha',
    'iframe[src*="captcha"]',
    'iframe[title*="challenge"]',
    'form#challenge-form',
  ].join(', ');

  /** URL fingerprints of interstitial pages (booking.com and the Kayak white-label). */
  private static readonly BOT_CHALLENGE_URL = /\/security\/check|\/challenge|captcha|px-captcha/i;

  /**
   * Live booking.com (and the Kayak flights white-label) occasionally serve a
   * CAPTCHA/bot challenge instead of the product page — most often to
   * datacenter IPs (CI runners). That is an environment condition, not a
   * product regression, so the test is skipped (yellow) instead of failing the
   * run (red). Detected by both the interstitial URL (e.g. Kayak's
   * `/security/check`) and known DOM markers. Called from dismissOverlays,
   * i.e. after every navigation in every flow.
   */
  protected async skipIfBotChallenged(): Promise<void> {
    let challenged = BasePage.BOT_CHALLENGE_URL.test(this.page.url());
    if (!challenged) {
      challenged = await this.page
        .locator(BasePage.BOT_CHALLENGE_MARKERS)
        .first()
        .isVisible()
        .catch(() => false);
    }
    test.skip(
      challenged,
      `A bot challenge was served on ${this.page.url()} — skipping, not a product failure`,
    );
  }

  /**
   * Run a (long) wait under bot-challenge protection. The interstitial can
   * land AFTER a page was sampled clean — Kayak, for one, redirects to
   * /security/check a moment after navigation — in which case the wait would
   * end in a healer timeout that reads like a selector failure. Sample before
   * the wait, and re-sample when it fails: a challenge that arrived meanwhile
   * skips the test; any other error is rethrown untouched.
   */
  protected async withChallengeGuard<T>(wait: () => Promise<T>): Promise<T> {
    await this.skipIfBotChallenged();
    try {
      return await wait();
    } catch (error) {
      await this.skipIfBotChallenged();
      throw error;
    }
  }

  /** Click that tolerates the element not being present (returns success flag). */
  protected async safeClick(locator: Locator, timeoutMs = 3_000): Promise<boolean> {
    try {
      await locator.click({ timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click the autocomplete suggestion matching `expected`. Suggestions render
   * progressively, so the matching option gets a short window to appear
   * before falling back to the top suggestion — an instant-check would race
   * the rendering and silently pick the wrong destination.
   */
  protected async clickSuggestion(
    options: Locator,
    expected: string,
    timeoutMs = 4_000,
  ): Promise<void> {
    const match = options.filter({ hasText: expected }).first();
    try {
      await match.waitFor({ state: 'visible', timeout: timeoutMs });
      await match.click();
    } catch {
      logger.warn(
        `[${this.pageName}] no suggestion matching "${expected}" appeared — using the top suggestion`,
      );
      await options.first().click();
    }
  }
}
