/**
 * Three-state failure gate for outbound integrations (closed → open → half-open).
 * Inject `now` for deterministic tests.
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureTimestamps: number[] = [];
  private openedAt: number | null = null;

  /**
   * @param failureThreshold - Failures within `windowMs` required to open (default 5)
   * @param windowMs - Sliding failure window in ms (default 60_000)
   * @param openDurationMs - Dwell time in open before half-open (default 30_000)
   * @param now - Clock for timestamps (default `Date.now`)
   */
  constructor(
    private readonly failureThreshold = 5,
    private readonly windowMs = 60_000,
    private readonly openDurationMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Current breaker state after applying open→half-open transitions. */
  getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  /** Whether an outbound call is allowed (`closed` or `half-open`). */
  canExecute(): boolean {
    this.refreshState();
    return this.state === 'closed' || this.state === 'half-open';
  }

  /** Seconds until a half-open probe is allowed, or `null` when not open. */
  getRetryAfterSeconds(): number | null {
    this.refreshState();
    if (this.state !== 'open' || this.openedAt === null) {
      return null;
    }

    const remainingMs = this.openDurationMs - (this.now() - this.openedAt);
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  /** Record a successful call and reset to closed. */
  recordSuccess(): void {
    this.failureTimestamps = [];
    this.state = 'closed';
    this.openedAt = null;
  }

  /** Record a failed call; may transition to open. */
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
