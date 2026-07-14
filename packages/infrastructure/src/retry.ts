/** Default exponential-ish backoff schedule (ms) used by {@link withRetry}. */
export const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

/**
 * Resolve after `ms` milliseconds.
 * @param ms - Delay duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Whether an HTTP status is considered transient for retries.
 * @param status - HTTP status code
 * @returns `true` for 429 or 5xx
 */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export interface WithRetryOptions {
  /** When false, stop retrying immediately and rethrow. Defaults to retry-all. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Execute `operation` up to `delaysMs.length` times, sleeping between failures.
 * @param operation - Async work to retry
 * @param delaysMs - Per-attempt backoff schedule (also defines max attempts)
 * @param options - Optional `shouldRetry` predicate
 * @returns Result of the first successful attempt
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  delaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
  options: WithRetryOptions = {},
): Promise<T> {
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt >= delaysMs.length - 1) {
        break;
      }

      await sleep(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1]!);
    }
  }

  throw lastError;
}
