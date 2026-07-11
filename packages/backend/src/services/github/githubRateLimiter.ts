export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  resetAt: number;
  queuedRequests: number;
}

export class GitHubRateLimiter {
  private limit = 5000;
  private remaining = 5000;
  private resetAt = 0;
  private queuedRequests = 0;

  constructor(private readonly now: () => number = Date.now) {}

  updateFromHeaders(headers: Headers): void {
    const limitHeader = headers.get('x-ratelimit-limit');
    const remainingHeader = headers.get('x-ratelimit-remaining');
    const resetHeader = headers.get('x-ratelimit-reset');

    if (limitHeader) {
      this.limit = Number(limitHeader);
    }
    if (remainingHeader) {
      this.remaining = Number(remainingHeader);
    }
    if (resetHeader) {
      this.resetAt = Number(resetHeader) * 1000;
    }
  }

  getSnapshot(): RateLimitSnapshot {
    return {
      limit: this.limit,
      remaining: this.remaining,
      resetAt: this.resetAt,
      queuedRequests: this.queuedRequests,
    };
  }

  async waitForCapacity(): Promise<void> {
    if (this.remaining >= 10) {
      return;
    }

    this.queuedRequests += 1;
    const waitMs = Math.max(0, this.resetAt - this.now());
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.remaining = this.limit;
        this.queuedRequests = Math.max(0, this.queuedRequests - 1);
        resolve();
      }, waitMs);
    });
  }
}

export const githubRateLimiter = new GitHubRateLimiter();
