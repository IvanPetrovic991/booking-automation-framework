import type { Locator, Page } from '@playwright/test';
import { env } from '../../config/env';
import { logger } from '../utils/logger';
import { HealingStore } from './HealingStore';
import type { ElementDefinition, LocateOptions } from './types';

const POLL_INTERVAL_MS = 250;

/** Errors that mean the page/test is gone — rethrown instead of "no match". */
const FATAL_MATCH_ERROR = /has been closed|browser has disconnected|test ended/i;

/**
 * Self-healing locator engine.
 *
 * Resolution algorithm for an {@link ElementDefinition}, repeated every
 * {@link POLL_INTERVAL_MS} until the deadline:
 *  1. The PRIMARY selector always gets the first shot. If it matches while a
 *     healed selector is persisted, the primary has recovered: the persisted
 *     entry is dropped and a 'recovered' event is recorded.
 *  2. The previously-healed PREFERRED selector is tried next (no new event —
 *     the heal is already known; the reporter lists active overrides).
 *  3. The remaining fallbacks are tried in order, but a fallback win is only
 *     accepted after a grace period (HEALER_GRACE_MS) has elapsed AND the
 *     primary fails one final re-check — a slow-rendering primary must never
 *     be permanently "healed" to a generic selector by one instant-check miss.
 *  4. If nothing matches by the deadline, throw a rich error listing every
 *     tried selector.
 *
 * A heal that would be ambiguous for a single-element lookup (the fallback
 * matches several elements) is reported but NOT persisted as preferred.
 */
export class SelfHealingLocator {
  /** Selectors already logged as not evaluable — log once, not per poll. */
  private readonly reportedUnevaluable = new Set<string>();

  constructor(
    private readonly page: Page,
    private readonly store: HealingStore,
  ) {}

  /** Resolve a definition to the first matching element. */
  async locate(definition: ElementDefinition, options: LocateOptions = {}): Promise<Locator> {
    const selector = await this.resolve(definition, options, { expectSingle: true });
    return this.scoped(selector, options).first();
  }

  /**
   * Resolve a definition to the full collection of matching elements —
   * for lists (result cards, autocomplete options) that callers want to
   * count, filter or iterate.
   */
  async locateAll(definition: ElementDefinition, options: LocateOptions = {}): Promise<Locator> {
    const selector = await this.resolve(definition, options, { expectSingle: false });
    return this.scoped(selector, options);
  }

  /**
   * Build the returned locator so it matches the exact set that qualified the
   * selector: for the default `visible` state a candidate wins when ANY match
   * is visible, so the returned locator must be visible-filtered too —
   * otherwise `.first()` could hand back a hidden first DOM node the healer
   * never actually checked. For `attached`, all matches count.
   */
  private scoped(selector: string, options: LocateOptions): Locator {
    const base = this.page.locator(selector);
    return (options.state ?? 'visible') === 'visible' ? base.filter({ visible: true }) : base;
  }

  private async resolve(
    definition: ElementDefinition,
    options: LocateOptions,
    { expectSingle }: { expectSingle: boolean },
  ): Promise<string> {
    const state = options.state ?? 'visible';
    const timeout = options.timeout ?? env.healerTimeout;
    // Never let the grace period consume the whole budget of short lookups.
    const grace = Math.min(env.healerGraceMs, Math.floor(timeout / 2));

    const primary = definition.candidates[0];
    if (!primary) {
      throw new Error(`[healer] Definition "${definition.key}" has no selector candidates.`);
    }
    const preferred = this.activePreferred(definition, primary);
    const fallbacks = [...new Set(definition.candidates.slice(1).filter((c) => c !== preferred))];

    const started = Date.now();
    const deadline = started + timeout;

    do {
      // 1. The primary always gets the first shot — this is also how a fixed
      //    primary reclaims its definition from a stale healed selector.
      if ((await this.matchCount(primary, state)) > 0) {
        this.dropOverrideOnRecovery(definition, primary);
        return primary;
      }

      // 2. The previously-healed selector is the known-good fallback.
      if (preferred && preferred !== primary && (await this.matchCount(preferred, state)) > 0) {
        return preferred;
      }

      // 3. Remaining fallbacks — only accepted once the grace period is over.
      if (Date.now() - started >= grace) {
        for (const [i, candidate] of fallbacks.entries()) {
          const count = await this.matchCount(candidate, state);
          if (count === 0) continue;
          // Last chance for a late primary before declaring a heal.
          if ((await this.matchCount(primary, state)) > 0) {
            this.dropOverrideOnRecovery(definition, primary);
            return primary;
          }
          this.reportHealed(definition, candidate, {
            ambiguous: expectSingle && count > 1,
            failedSelectors: [
              primary,
              ...(preferred && preferred !== primary ? [preferred] : []),
              ...fallbacks.slice(0, i),
            ],
          });
          return candidate;
        }
      }

      await this.page.waitForTimeout(POLL_INTERVAL_MS);
    } while (Date.now() < deadline);

    const tried = [
      primary,
      ...(preferred && preferred !== primary ? [preferred] : []),
      ...fallbacks,
    ];
    throw new Error(
      `[healer] Could not locate "${definition.key}"` +
        (definition.description ? ` (${definition.description})` : '') +
        ` within ${timeout}ms on ${this.page.url()}.\n` +
        `Tried selectors:\n${tried.map((c) => `  - ${c}`).join('\n')}\n` +
        `Add a working fallback candidate to this definition to enable healing.`,
    );
  }

  /**
   * Number of elements currently matching the selector in the required
   * state. Counts ALL matches (not just the first), so a candidate whose
   * first DOM match is hidden still qualifies when a later match is visible.
   */
  private async matchCount(selector: string, state: 'visible' | 'attached'): Promise<number> {
    try {
      const matches = this.page.locator(selector);
      if (state === 'visible') return await matches.filter({ visible: true }).count();
      return await matches.count();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Page/context torn down mid-check — a real failure, not a "no match".
      if (FATAL_MATCH_ERROR.test(message)) throw error;
      if (!this.reportedUnevaluable.has(selector)) {
        this.reportedUnevaluable.add(selector);
        logger.debug(`[healer] Candidate not evaluable: "${selector}" (${message.split('\n')[0]})`);
      }
      return 0;
    }
  }

  /**
   * The persisted preferred selector, if it is still usable for this
   * definition. Two cases drop and forget a stored entry instead of using it:
   *  - the definition became `volatile` since the heal (its selector carries
   *    runtime data now, so a preferred entry is meaningless);
   *  - the stored selector is no longer among the candidates (the team edited
   *    the page object), so trying it first forever is wrong.
   */
  private activePreferred(definition: ElementDefinition, primary: string): string | undefined {
    const preferred = this.store.getPreferred(definition.key);
    if (!preferred) return undefined;
    if (definition.volatile) {
      this.storeRecovery(definition, primary, preferred);
      logger.info(
        `[healer] "${definition.key}": definition is now volatile — dropped stored selector "${preferred}".`,
      );
      return undefined;
    }
    if (!definition.candidates.includes(preferred)) {
      this.storeRecovery(definition, primary, preferred);
      logger.info(
        `[healer] "${definition.key}": stored selector "${preferred}" is no longer a candidate — dropped.`,
      );
      return undefined;
    }
    return preferred;
  }

  /** Record a recovery event (drops the persisted override) without logging. */
  private storeRecovery(
    definition: ElementDefinition,
    primary: string,
    previousPreferred: string,
  ): void {
    this.store.recordRecovery({
      kind: 'recovered',
      key: definition.key,
      description: definition.description,
      failedSelectors: [],
      healedSelector: primary,
      previousPreferred,
      persistPreferred: false,
      url: this.page.url(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * The primary matched, so any persisted override is now redundant — drop it
   * regardless of whether it equalled the primary (a team that promoted the
   * healed selector to primary leaves preferred === primary; that entry must
   * still be forgotten so the reporter stops flagging a phantom override).
   */
  private dropOverrideOnRecovery(definition: ElementDefinition, primary: string): void {
    if (definition.volatile) return;
    const persisted = this.store.getPreferred(definition.key);
    if (persisted) this.reportRecovered(definition, primary, persisted);
  }

  private reportHealed(
    definition: ElementDefinition,
    winner: string,
    { ambiguous, failedSelectors }: { ambiguous: boolean; failedSelectors: string[] },
  ): void {
    const primary = definition.candidates[0];
    const persistPreferred = !definition.volatile && !ambiguous;
    this.store.recordHealing({
      kind: 'healed',
      key: definition.key,
      description: definition.description,
      failedSelectors,
      healedSelector: winner,
      persistPreferred,
      url: this.page.url(),
      timestamp: new Date().toISOString(),
    });
    logger.warn(
      `🩹 [healer] "${definition.key}" healed: primary "${primary}" failed, using "${winner}"` +
        (definition.volatile ? ' (volatile — not persisted)' : '') +
        (ambiguous ? ' (matches multiple elements — not persisted, refine the candidate)' : ''),
    );
  }

  private reportRecovered(
    definition: ElementDefinition,
    primary: string,
    previousPreferred: string,
  ): void {
    this.storeRecovery(definition, primary, previousPreferred);
    logger.info(
      `✅ [healer] "${definition.key}" recovered: primary "${primary}" matches again` +
        (previousPreferred === primary
          ? ' — dropped redundant override.'
          : ` — dropped healed selector "${previousPreferred}".`),
    );
  }
}
