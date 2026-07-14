import { describe, expect, it } from 'vitest';
import { systemClock, type Clock } from './clock.js';

describe('Clock', () => {
  it('exports systemClock that returns a Date', () => {
    const now = systemClock();
    expect(now).toBeInstanceOf(Date);

    const fixed: Clock = () => new Date('2026-01-01T00:00:00.000Z');
    expect(fixed().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
