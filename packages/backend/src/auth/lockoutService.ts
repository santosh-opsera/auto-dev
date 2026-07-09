import { LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS } from './constants.js';

interface LockoutEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil?: number;
}

const lockouts = new Map<string, LockoutEntry>();

export function recordAuthFailure(key: string): { locked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const entry = lockouts.get(key) ?? { failures: 0, firstFailureAt: now };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { locked: true, remainingAttempts: 0 };
  }

  if (now - entry.firstFailureAt > LOCKOUT_WINDOW_MS) {
    entry.failures = 0;
    entry.firstFailureAt = now;
    entry.lockedUntil = undefined;
  }

  entry.failures += 1;

  if (entry.failures >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_WINDOW_MS;
    lockouts.set(key, entry);
    return { locked: true, remainingAttempts: 0 };
  }

  lockouts.set(key, entry);
  return {
    locked: false,
    remainingAttempts: LOCKOUT_THRESHOLD - entry.failures,
  };
}

export function clearAuthFailures(key: string): void {
  lockouts.delete(key);
}

export function isLockedOut(key: string): boolean {
  const entry = lockouts.get(key);
  if (!entry?.lockedUntil) {
    return false;
  }

  if (entry.lockedUntil <= Date.now()) {
    lockouts.delete(key);
    return false;
  }

  return true;
}

export function resetLockouts(): void {
  lockouts.clear();
}
