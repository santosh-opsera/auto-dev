import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_DELAYS_MS, isRetryableHttpStatus, sleep, withRetry } from './retry.js';

describe('retry utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('identifies retryable HTTP statuses', () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(404)).toBe(false);
  });

  it('sleeps for the requested duration', async () => {
    vi.useFakeTimers();
    const promise = sleep(25);
    await vi.advanceTimersByTimeAsync(25);
    await expect(promise).resolves.toBeUndefined();
  });

  it('retries failed operations with configured delays', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');

    const promise = withRetry(operation, [10, 20, 30]);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retry attempts', async () => {
    vi.useFakeTimers();
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('failed'));

    const promise = withRetry(operation, DEFAULT_RETRY_DELAYS_MS.map(() => 1));
    const expectation = expect(promise).rejects.toThrow('failed');
    await vi.runAllTimersAsync();
    await expectation;
    expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_DELAYS_MS.length);
  });

  it('stops immediately when shouldRetry returns false', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('fatal'));

    await expect(
      withRetry(operation, [10, 20, 30], { shouldRetry: () => false }),
    ).rejects.toThrow('fatal');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
