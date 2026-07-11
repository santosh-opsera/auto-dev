export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureTimestamps: number[] = [];
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = 5,
    private readonly windowMs = 60_000,
    private readonly openDurationMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  canExecute(): boolean {
    this.refreshState();
    return this.state === 'closed' || this.state === 'half-open';
  }

  getRetryAfterSeconds(): number | null {
    this.refreshState();
    if (this.state !== 'open' || this.openedAt === null) {
      return null;
    }

    const remainingMs = this.openDurationMs - (this.now() - this.openedAt);
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  recordSuccess(): void {
    this.failureTimestamps = [];
    this.state = 'closed';
    this.openedAt = null;
  }

  recordFailure(): void {
    const timestamp = this.now();
    this.failureTimestamps.push(timestamp);
    this.failureTimestamps = this.failureTimestamps.filter(
      (entry) => timestamp - entry <= this.windowMs,
    );

    if (this.state === 'half-open' || this.failureTimestamps.length >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = timestamp;
    }
  }

  private refreshState(): void {
    if (this.state !== 'open' || this.openedAt === null) {
      return;
    }

    if (this.now() - this.openedAt >= this.openDurationMs) {
      this.state = 'half-open';
    }
  }
}
