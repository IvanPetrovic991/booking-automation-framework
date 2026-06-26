import * as dotenv from 'dotenv';

// .env.local (git-ignored, developer-specific) wins over the shared .env.
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Positive-integer knob — zero/negative/garbage falls back to the default. */
function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function toLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  return LOG_LEVELS.includes(value as LogLevel) ? (value as LogLevel) : fallback;
}

/**
 * Centralized, typed runtime configuration. Every knob the framework uses
 * comes from here so environments (local / CI / staging mirrors) only differ
 * by their .env file. All values are validated — an invalid value falls back
 * to the default instead of silently breaking behavior downstream.
 */
export const env = {
  baseUrl: process.env.BASE_URL ?? 'https://www.booking.com',
  headless: toBool(process.env.HEADLESS, true),
  isCI: toBool(process.env.CI, false),
  testTimeout: toPositiveInt(process.env.DEFAULT_TEST_TIMEOUT, 150_000),
  expectTimeout: toPositiveInt(process.env.EXPECT_TIMEOUT, 15_000),
  healerTimeout: toPositiveInt(process.env.HEALER_TIMEOUT, 20_000),
  /**
   * How long the primary selector keeps exclusive right to match before the
   * healer may promote a fallback — prevents false heals when the primary
   * simply renders late. Capped at half the lookup timeout.
   */
  healerGraceMs: toPositiveInt(process.env.HEALER_GRACE_MS, 2_000),
  logLevel: toLogLevel(process.env.LOG_LEVEL, 'info'),
  /** Abort requests to third-party analytics/trackers — faster, more stable runs. */
  blockTrackers: toBool(process.env.BLOCK_TRACKERS, true),
} as const;
