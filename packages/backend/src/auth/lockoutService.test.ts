import { beforeEach, describe, expect, it } from 'vitest';
import { LOCKOUT_THRESHOLD } from './constants.js';
import { isLockedOut, recordAuthFailure, resetLockouts } from './lockoutService.js';

describe('lockoutService', () => {
  beforeEach(() => {
    resetLockouts();
  });

  it('locks out after 10 failed attempts within 15 minutes', () => {
    const key = '127.0.0.1';

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD - 1; attempt += 1) {
      const result = recordAuthFailure(key);
      expect(result.locked).toBe(false);
    }

    const final = recordAuthFailure(key);
    expect(final.locked).toBe(true);
    expect(isLockedOut(key)).toBe(true);
  });
});
