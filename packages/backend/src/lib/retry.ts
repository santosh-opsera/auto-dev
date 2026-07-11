export const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  delaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= delaysMs.length - 1) {
        break;
      }

      await sleep(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1]!);
    }
  }

  throw lastError;
}
