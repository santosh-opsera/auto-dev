import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from './circuitBreaker.js';

describe('CircuitBreaker', () => {
  it('opens after five failures within the window', () => {
    let now = 1_000;
    const breaker = new CircuitBreaker(5, 60_000, 30_000, () => now);

    for (let index = 0; index < 5; index += 1) {
      breaker.recordFailure();
      now += 1_000;
    }

    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
    expect(breaker.getRetryAfterSeconds()).toBeGreaterThanOrEqual(29);
  });

  it('transitions to half-open after 30 seconds and closes on success', () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 60_000, 30_000, () => now);

    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');

    now = 30_000;
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe('half-open');

    breaker.recordSuccess();
    expect(breaker.getState()).toBe('closed');
  });

  it('reopens when half-open test request fails', () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 60_000, 30_000, () => now);

    breaker.recordFailure();
    now = 30_000;
    expect(breaker.canExecute()).toBe(true);
    breaker.recordFailure();

    expect(breaker.getState()).toBe('open');
  });
});
