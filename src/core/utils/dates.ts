/**
 * Date helpers — booking.com calendars key their day cells by a
 * `data-date="YYYY-MM-DD"` attribute, so everything works with that format.
 */

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ISO date `daysFromNow` days in the future (local time). */
export function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return formatIsoDate(date);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

/**
 * Matches the short, locale-rendered forms of an ISO date as the en-US search
 * forms display it — Kayak's `7/25`, booking's `Jul 25` / `25 Jul` — bounded
 * so `7/25` cannot match inside `17/250`. Lets a spec assert "the page shows
 * the requested date" without knowing which product variant rendered it.
 */
export function displayedDatePattern(isoDate: string): RegExp {
  const date = new Date(`${isoDate}T12:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthShort = date.toLocaleString('en-US', { month: 'short' });
  return new RegExp(`(?<!\\d)(${month}/${day}|${monthShort} ${day}|${day} ${monthShort})(?!\\d)`);
}
