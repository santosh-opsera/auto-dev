import { LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS } from '../auth/constants.js';

export interface LockoutEntryFixture {
  key: string;
  failures: number;
  firstFailureAt: Date;
  lockedUntil?: Date;
  expiresAt: Date;
  dataClassification: 'internal';
}

const FIXED_NOW = new Date('2026-07-14T10:00:00.000Z');

/** Mid-window entry with a few failures (not yet locked). */
export const lockoutPartialFailuresFixture: LockoutEntryFixture = {
  key: '192.0.2.10',
  failures: 3,
  firstFailureAt: new Date(FIXED_NOW.getTime() - 2 * 60 * 1000),
  expiresAt: new Date(FIXED_NOW.getTime() - 2 * 60 * 1000 + LOCKOUT_WINDOW_MS),
  dataClassification: 'internal',
};

/** One failure below threshold — next failure locks out. */
export const lockoutNearThresholdFixture: LockoutEntryFixture = {
  key: '192.0.2.20',
  failures: LOCKOUT_THRESHOLD - 1,
  firstFailureAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 1000),
  expiresAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 1000 + LOCKOUT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Actively locked-out client IP. */
export const lockoutActiveFixture: LockoutEntryFixture = {
  key: '192.0.2.30',
  failures: LOCKOUT_THRESHOLD,
  firstFailureAt: new Date(FIXED_NOW.getTime() - 1 * 60 * 1000),
  lockedUntil: new Date(FIXED_NOW.getTime() + LOCKOUT_WINDOW_MS),
  expiresAt: new Date(FIXED_NOW.getTime() + LOCKOUT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Expired lockout — lockedUntil in the past (TTL should also remove). */
export const lockoutExpiredFixture: LockoutEntryFixture = {
  key: '192.0.2.40',
  failures: LOCKOUT_THRESHOLD,
  firstFailureAt: new Date(FIXED_NOW.getTime() - LOCKOUT_WINDOW_MS - 60_000),
  lockedUntil: new Date(FIXED_NOW.getTime() - 60_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 60_000),
  dataClassification: 'internal',
};

/** Fresh single-failure entry. */
export const lockoutFreshFailureFixture: LockoutEntryFixture = {
  key: '192.0.2.50',
  failures: 1,
  firstFailureAt: FIXED_NOW,
  expiresAt: new Date(FIXED_NOW.getTime() + LOCKOUT_WINDOW_MS),
  dataClassification: 'internal',
};

export const lockoutEntryFixtures: LockoutEntryFixture[] = [
  lockoutPartialFailuresFixture,
  lockoutNearThresholdFixture,
  lockoutActiveFixture,
  lockoutExpiredFixture,
  lockoutFreshFailureFixture,
];
