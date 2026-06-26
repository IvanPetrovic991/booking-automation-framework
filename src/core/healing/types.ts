/**
 * A self-healing element definition: a stable logical key plus an ordered
 * list of selector candidates. The first candidate is the "primary" — the
 * one the team considers canonical. Every candidate after it is a fallback
 * the healer may promote when the primary stops matching.
 */
export interface ElementDefinition {
  /** Unique, stable, human-readable key, e.g. `stays.searchbox.destinationInput`. */
  key: string;
  /** Ordered selectors — primary first, fallbacks after. */
  candidates: string[];
  /** Optional human description used in logs and error messages. */
  description?: string;
  /**
   * Volatile definitions contain runtime data baked into the selector
   * (e.g. a concrete calendar date). Healing events are still reported,
   * but the healed selector is NOT persisted as preferred for future runs.
   */
  volatile?: boolean;
}

export interface HealingEvent {
  /**
   * 'healed'    — the primary failed and a fallback was promoted.
   * 'recovered' — the primary matches again (or the stored selector went
   *               stale), so the persisted preferred selector was dropped.
   * Events from older store versions carry no kind and are read as 'healed'.
   */
  kind?: 'healed' | 'recovered';
  key: string;
  description?: string;
  /** Selectors that were tried and did not match before the winner. */
  failedSelectors: string[];
  /** The selector that actually matched (for 'recovered': the primary). */
  healedSelector: string;
  /** For 'recovered' events: the preferred selector that was dropped. */
  previousPreferred?: string;
  /** Whether the healed selector should be persisted as preferred. */
  persistPreferred: boolean;
  url: string;
  timestamp: string;
}

export interface HealingStoreShape {
  /** Logical key -> selector that worked last time (tried first next run). */
  preferred: Record<string, string>;
  /** Rolling history of healing events across runs. */
  events: HealingEvent[];
  updatedAt?: string;
}

export interface LocateOptions {
  /** Required element state for a candidate to be considered a match. */
  state?: 'visible' | 'attached';
  /** Overall healing deadline in ms (overrides the global healer timeout). */
  timeout?: number;
}
