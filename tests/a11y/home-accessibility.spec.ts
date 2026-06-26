import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../../src/fixtures/test';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type Violation = AxeResults['violations'][number];

const WCAG_TAGS = ['wcag2a', 'wcag2aa'];

/**
 * Regions the gate covers: the global header and the stays search box — the
 * UI this suite actually operates, so "the flows this framework drives are
 * accessible" is the claim that fails the test. The rest of the home page is
 * promotional content that booking.com rotates between A/B variants, each with
 * its own markup defects (a `<ul>` with `role="none"` children in one
 * carousel, `<picture aria-label>` country flags in another); gating on it
 * would turn the suite red on the site's marketing calendar, not on
 * regressions. The full-page scan still runs every time — attached to the
 * report and summarized as a test annotation, for triage rather than gating.
 */
const GATED_REGIONS = ['header', 'form:has(input[name="ss"])'];

/** Anything below these impacts is triage material in the attached report, not a gate. */
const GATING_IMPACTS = new Set(['critical', 'serious']);

function gatingViolations(violations: Violation[]): Violation[] {
  return violations.filter((violation) => GATING_IMPACTS.has(violation.impact ?? ''));
}

test.describe('Accessibility — home page', () => {
  test(
    'header and search box have no critical or serious accessibility violations',
    { tag: ['@a11y', '@regression'] },
    async ({ staysHomePage }, testInfo) => {
      await staysHomePage.open();
      const { page } = staysHomePage;

      // No vacuous pass: every gated region must actually be on the page.
      for (const region of GATED_REGIONS) {
        await expect(page.locator(region).first(), `Gated region "${region}"`).toBeVisible();
      }

      const gatedScan = new AxeBuilder({ page }).withTags(WCAG_TAGS);
      for (const region of GATED_REGIONS) gatedScan.include(region);
      const gated = gatingViolations((await gatedScan.analyze()).violations);

      const fullPage = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      await testInfo.attach('axe-full-page-report', {
        body: JSON.stringify(fullPage.violations, null, 2),
        contentType: 'application/json',
      });
      const fullPageGating = gatingViolations(fullPage.violations);
      testInfo.annotations.push({
        type: 'a11y full page (informational)',
        description:
          fullPageGating.length === 0
            ? 'no critical/serious violations'
            : `${fullPageGating.length} critical/serious rule(s): ${fullPageGating
                .map((violation) => violation.id)
                .join(', ')} — see the attached report`,
      });

      expect(
        gated,
        `Critical/serious a11y violations in the header/search box: ${gated
          .map((violation) => violation.id)
          .join(', ')}`,
      ).toEqual([]);
    },
  );

  test(
    'global header navigation exposes the expected accessibility tree',
    { tag: ['@a11y', '@smoke'] },
    async ({ staysHomePage }) => {
      await staysHomePage.open();

      // Aria snapshot = structural accessibility assertion (Playwright 1.49+).
      // Partial template: extra menu items (e.g. regional products) are allowed.
      await expect(staysHomePage.page.getByRole('menubar').first()).toMatchAriaSnapshot(`
        - menubar:
          - menuitem "Stays"
          - menuitem "Flights"
          - menuitem "Car rental"
          - menuitem "Attractions"
      `);
    },
  );
});
