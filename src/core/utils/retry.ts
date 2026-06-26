export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  description?: string;
}

/**
 * Generic async retry with linear back-off. Use for steps that are
 * legitimately racy (overlays, lazy-loaded widgets), never to paper over
 * real product bugs.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  const label = options.description ? ` (${options.description})` : '';
  throw new Error(`All ${attempts} retry attempts failed${label}: ${String(lastError)}`);
}
