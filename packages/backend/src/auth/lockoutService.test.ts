import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS } from './constants.js';
import {
  clearAuthFailures,
  isLockedOut,
  recordAuthFailure,
  resetLockouts,
} from './lockoutService.js';
import { ensureIndexes } from '../database/indexes.js';
import {
  getLockoutModel,
  buildLockoutWindowExpiry,
} from '../models/lockoutModel.js';
import {
  lockoutActiveFixture,
  lockoutEntryFixtures,
  lockoutNearThresholdFixture,
} from '../fixtures/lockout.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

describe('lockoutService (MongoDB TTL)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getLockoutModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetLockouts();
  });

  it('locks out after 10 failed attempts within 15 minutes', async () => {
    const key = '127.0.0.1';

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD - 1; attempt += 1) {
      const result = await recordAuthFailure(key);
      expect(result.locked).toBe(false);
      expect(result.remainingAttempts).toBe(LOCKOUT_THRESHOLD - attempt - 1);
    }

    const final = await recordAuthFailure(key);
    expect(final.locked).toBe(true);
    expect(final.remainingAttempts).toBe(0);
    expect(await isLockedOut(key)).toBe(true);

    const stored = await getLockoutModel().findOne({ key }).lean().exec();
    expect(stored).toBeTruthy();
    expect(stored!.failures).toBe(LOCKOUT_THRESHOLD);
    expect(stored!.lockedUntil).toBeInstanceOf(Date);
    expect(stored!.expiresAt.getTime()).toBe(stored!.lockedUntil!.getTime());
  });

  it('increments failure count in MongoDB and sets window expiresAt', async () => {
    const key = '10.0.0.1';
    const result = await recordAuthFailure(key);

    expect(result.locked).toBe(false);
    expect(result.remainingAttempts).toBe(LOCKOUT_THRESHOLD - 1);

    const stored = await getLockoutModel().findOne({ key }).lean().exec();
    expect(stored).toMatchObject({ key, failures: 1 });
    expect(stored!.expiresAt.getTime()).toBe(
      buildLockoutWindowExpiry(stored!.firstFailureAt).getTime(),
    );
    expect(stored!.lockedUntil).toBeUndefined();
  });

  it('clearAuthFailures removes the document and resets lockout state', async () => {
    const key = lockoutNearThresholdFixture.key;

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      await recordAuthFailure(key);
    }
    expect(await isLockedOut(key)).toBe(true);

    await clearAuthFailures(key);

    expect(await isLockedOut(key)).toBe(false);
    expect(await getLockoutModel().findOne({ key }).exec()).toBeNull();
  });

  it('persists lockout across service re-instantiation (new model handle)', async () => {
    const key = '198.51.100.1';

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      await recordAuthFailure(key);
    }

    // Simulate another process/instance reading via a fresh model accessor
    const otherModel = getLockoutModel();
    const doc = await otherModel.findOne({ key }).lean().exec();
    expect(doc?.failures).toBe(LOCKOUT_THRESHOLD);
    expect(doc?.lockedUntil).toBeInstanceOf(Date);

    expect(await isLockedOut(key)).toBe(true);
  });

  it('defines a TTL index on expiresAt with expireAfterSeconds: 0', async () => {
    const indexes = await getLockoutModel().collection.indexes();
    const ttlIndex = indexes.find(
      (index) =>
        index.expireAfterSeconds === 0 &&
        index.key &&
        (index.key as Record<string, number>).expiresAt === 1,
    );

    expect(ttlIndex).toBeDefined();
  });

  it('seeds lockout fixtures with expected failure counts and timestamps', async () => {
    await getLockoutModel().insertMany(lockoutEntryFixtures);

    const active = await getLockoutModel().findOne({ key: lockoutActiveFixture.key }).lean().exec();
    expect(active?.failures).toBe(LOCKOUT_THRESHOLD);
    expect(active?.lockedUntil).toBeInstanceOf(Date);
    expect(active!.expiresAt.getTime()).toBe(active!.lockedUntil!.getTime());

    const near = await getLockoutModel()
      .findOne({ key: lockoutNearThresholdFixture.key })
      .lean()
      .exec();
    expect(near?.failures).toBe(LOCKOUT_THRESHOLD - 1);
    expect(near?.lockedUntil).toBeUndefined();
    expect(near!.expiresAt.getTime() - near!.firstFailureAt.getTime()).toBe(LOCKOUT_WINDOW_MS);
  });

  it('returns locked immediately when already locked without incrementing', async () => {
    const key = '203.0.113.1';
    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      await recordAuthFailure(key);
    }

    const before = await getLockoutModel().findOne({ key }).lean().exec();
    const again = await recordAuthFailure(key);

    expect(again).toEqual({ locked: true, remainingAttempts: 0 });
    const after = await getLockoutModel().findOne({ key }).lean().exec();
    expect(after?.failures).toBe(before?.failures);
  });
});
