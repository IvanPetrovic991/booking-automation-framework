import type { ElementDefinition } from '../../src/core/healing/types';
import { expect, test } from '../../src/fixtures/test';

/**
 * Verifies the self-healing engine end to end against the live home page.
 * Demo keys (demo.*) are reported like real heals but never persisted to the
 * git-tracked store, so these tests cannot pollute real selector telemetry.
 *
 * Each test calls store.forget() first, so it proves a LIVE heal recorded in
 * this very run — never a pass inherited from pre-seeded state.
 */
test.describe('Self-healing engine', () => {
  test(
    'broken primary selector heals to a working fallback and is recorded',
    { tag: ['@healer', '@smoke'] },
    async ({ staysHomePage, healer, healingStoreInstance }) => {
      await staysHomePage.open();

      const brokenPrimary = '#definitely-not-a-real-selector-2026';
      const workingFallback = 'input[name="ss"]';
      const definition: ElementDefinition = {
        key: 'demo.healing.destinationInput',
        description: 'Healer demo — destination input with broken primary',
        candidates: [brokenPrimary, workingFallback],
      };
      healingStoreInstance.forget(definition.key);

      const located = await healer.locate(definition);
      await expect(located).toBeVisible();

      // The heal must have happened in THIS run: event recorded + promoted.
      const events = healingStoreInstance
        .getSessionEvents()
        .filter((event) => event.key === definition.key && event.kind === 'healed');
      expect(events.map((event) => event.healedSelector)).toContain(workingFallback);
      expect(healingStoreInstance.getPreferred(definition.key)).toBe(workingFallback);
    },
  );

  test(
    'volatile definitions heal without persisting a preferred selector',
    { tag: ['@healer', '@regression'] },
    async ({ staysHomePage, healer, healingStoreInstance }) => {
      await staysHomePage.open();

      const definition: ElementDefinition = {
        key: 'demo.healing.volatileElement',
        description: 'Healer demo — volatile definition',
        volatile: true,
        candidates: ['#broken-volatile-selector', 'input[name="ss"]'],
      };
      healingStoreInstance.forget(definition.key);

      const located = await healer.locate(definition);
      await expect(located).toBeVisible();

      const events = healingStoreInstance
        .getSessionEvents()
        .filter((event) => event.key === definition.key && event.kind === 'healed');
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((event) => !event.persistPreferred)).toBe(true);
      expect(healingStoreInstance.getPreferred(definition.key)).toBeUndefined();
    },
  );

  test(
    'a recovered primary drops the persisted fallback selector',
    { tag: ['@healer', '@regression'] },
    async ({ staysHomePage, healer, healingStoreInstance }) => {
      await staysHomePage.open();

      const workingPrimary = 'input[name="ss"]';
      const healedFallback = 'form input';
      const definition: ElementDefinition = {
        key: 'demo.healing.recoveredPrimary',
        description: 'Healer demo — primary works again after an earlier heal',
        candidates: [workingPrimary, healedFallback],
      };

      // Simulate an earlier run that healed this key to the fallback.
      healingStoreInstance.forget(definition.key);
      healingStoreInstance.recordHealing({
        kind: 'healed',
        key: definition.key,
        description: definition.description,
        failedSelectors: [workingPrimary],
        healedSelector: healedFallback,
        persistPreferred: true,
        url: staysHomePage.page.url(),
        timestamp: new Date().toISOString(),
      });
      expect(healingStoreInstance.getPreferred(definition.key)).toBe(healedFallback);

      // The primary matches on the live page, so the engine must use it and
      // drop the stale override.
      const located = await healer.locate(definition);
      await expect(located).toBeVisible();

      expect(healingStoreInstance.getPreferred(definition.key)).toBeUndefined();
      const recoveries = healingStoreInstance
        .getSessionEvents()
        .filter((event) => event.key === definition.key && event.kind === 'recovered');
      expect(recoveries.length).toBeGreaterThan(0);
    },
  );
});
