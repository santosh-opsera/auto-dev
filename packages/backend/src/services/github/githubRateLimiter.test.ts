import { describe, expect, it, vi } from 'vitest';
import { GitHubRateLimiter } from './githubRateLimiter.js';

describe('GitHubRateLimiter', () => {
  it('queues requests when remaining capacity is below 10', async () => {
    vi.useFakeTimers();
    let now = 1_000;
    const limiter = new GitHubRateLimiter(() => now);

    const headers = new Headers({
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '5',
      'x-ratelimit-reset': '2',
    });
    limiter.updateFromHeaders(headers);

    const waitPromise = limiter.waitForCapacity();
    expect(limiter.getSnapshot().queuedRequests).toBe(1);

    now = 2_000;
    await vi.advanceTimersByTimeAsync(1_000);
    await waitPromise;

    expect(limiter.getSnapshot().remaining).toBe(5000);
    vi.useRealTimers();
  });

  it('does not queue when remaining capacity is healthy', async () => {
    const limiter = new GitHubRateLimiter();
    limiter.updateFromHeaders(
      new Headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '100',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
      }),
    );

    await limiter.waitForCapacity();
    expect(limiter.getSnapshot().queuedRequests).toBe(0);
  });
});
