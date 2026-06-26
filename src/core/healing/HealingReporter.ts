import type { FullResult, Reporter } from '@playwright/test/reporter';
import { HealingStore } from './HealingStore';

/**
 * Custom Playwright reporter that consolidates per-worker healing events
 * after the run and prints a human-readable healing summary. Registered in
 * playwright.config.ts alongside the standard reporters.
 *
 * The summary always includes the ACTIVE preferred overrides — not just this
 * run's events — so "tests are green but running on fallback selectors" is
 * never invisible.
 */
export default class HealingReporter implements Reporter {
  printsToStdio(): boolean {
    return false;
  }

  onBegin(): void {
    // A crashed previous run must not leak its worker event files into this
    // run's summary and store.
    HealingStore.clearEvents();
  }

  onEnd(_result: FullResult): void {
    const { runEvents, store } = HealingStore.consolidate();
    const healed = runEvents.filter((event) => event.kind !== 'recovered');
    const recovered = runEvents.filter((event) => event.kind === 'recovered');
    const overrides = Object.entries(store.preferred);

    const lines: string[] = [''];

    if (healed.length > 0) {
      lines.push('🩹 Self-healing summary — the following selectors were healed:', '─'.repeat(80));
      for (const event of healed) {
        lines.push(
          `  • ${event.key}${event.description ? ` — ${event.description}` : ''}`,
          `      failed:  ${event.failedSelectors.join(' | ') || '(none reached before winner)'}`,
          `      healed:  ${event.healedSelector}`,
          `      page:    ${event.url}`,
          `      persist: ${event.persistPreferred ? 'yes (preferred for future runs)' : 'no (volatile or ambiguous)'}`,
        );
      }
      lines.push('─'.repeat(80));
    } else {
      lines.push('🩹 Self-healing: no selectors needed healing in this run.');
    }

    if (recovered.length > 0) {
      lines.push('✅ Recovered primaries — persisted fallbacks dropped:');
      for (const event of recovered) {
        lines.push(
          `  • ${event.key}: primary "${event.healedSelector}" matches again` +
            (event.previousPreferred ? ` (was "${event.previousPreferred}")` : ''),
        );
      }
    }

    if (overrides.length > 0) {
      lines.push(
        `⚠️  ${overrides.length} preferred override(s) active — these definitions pass via`,
        '    fallback selectors while their primaries stay broken:',
      );
      for (const [key, selector] of overrides) {
        lines.push(`  • ${key} → ${selector}`);
      }
      lines.push(
        '    Update the primary selectors in the page objects (the engine drops an',
        '    override automatically once its primary matches again), or run',
        '    `npm run healing:reset` to start fresh.',
      );
    } else if (healed.length === 0 && recovered.length === 0) {
      lines.push('    No preferred overrides active — every definition uses its primary selector.');
    }

    lines.push('');
    console.log(lines.join('\n'));
  }
}
