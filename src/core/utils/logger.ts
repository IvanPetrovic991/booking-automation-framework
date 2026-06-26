import { env } from '../../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function log(level: Level, message: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[env.logLevel]) return;
  const timestamp = new Date().toISOString();

  console.log(
    `${COLORS[level]}[${timestamp}] [${level.toUpperCase().padEnd(5)}]${RESET} ${message}`,
  );
}

export const logger = {
  debug: (message: string) => log('debug', message),
  info: (message: string) => log('info', message),
  warn: (message: string) => log('warn', message),
  error: (message: string) => log('error', message),
};
