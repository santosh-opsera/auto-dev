import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from '../auth/constants.js';
import { ensureIndexes } from '../database/indexes.js';
import {
  rateLimitEntryFixtures,
  rateLimitExceededAuthFixture,
  rateLimitFreshAuthFixture,
  rateLimitNearAuthLimitFixture,
} from '../fixtures/rateLimit.js';
import {
  buildRateLimitExpiry,
  getRateLimitModel,
} from '../models/rateLimitModel.js';
import {
  calculateRetryAfterSeconds,
  MongoRateLimitStore,
  resetAllRateLimits,
} from './mongoRateLimitStore.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

describe('MongoRateLimitStore', () => {
  const store = new MongoRateLimitStore('auth');

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getRateLimitModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAllRateLimits();
  });

  it('increments counts correctly across hits', async () => {
    const clientIp = '198.51.100.1';

    const first = await store.hit(clientIp, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS);
    expect(first.limited).toBe(false);
    expect(first.count).toBe(1);

    const second = await store.hit(clientIp, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS);
    expect(second.limited).toBe(false);
    expect(second.count).toBe(2);

    const stored = await getRateLimitModel().findOne({ clientIp, bucket: 'auth' }).lean().exec();
    expect(stored?.count).toBe(2);
    expect(stored!.expiresAt.getTime()).toBe(
      buildRateLimitExpiry(stored!.windowStart, AUTH_RATE_LIMIT_WINDOW_MS).getTime(),
    );
  });

  it('returns limited=true when the limit is exceeded', async () => {
    const clientIp = '198.51.100.2';
    const max = 3;

    expect((await store.hit(clientIp, max, AUTH_RATE_LIMIT_WINDOW_MS)).limited).toBe(false);
    expect((await store.hit(clientIp, max, AUTH_RATE_LIMIT_WINDOW_MS)).limited).toBe(false);
    expect((await store.hit(clientIp, max, AUTH_RATE_LIMIT_WINDOW_MS)).limited).toBe(false);

    const blocked = await store.hit(clientIp, max, AUTH_RATE_LIMIT_WINDOW_MS);
    expect(blocked.limited).toBe(true);
    expect(blocked.count).toBe(4);
  });

  it('sets TTL expiresAt to the window expiry', async () => {
    const clientIp = '198.51.100.3';
    const result = await store.hit(clientIp, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS);

    expect(result.expiresAt.getTime()).toBe(
      buildRateLimitExpiry(result.windowStart, AUTH_RATE_LIMIT_WINDOW_MS).getTime(),
    );

    const stored = await getRateLimitModel().findOne({ clientIp, bucket: 'auth' }).lean().exec();
    expect(stored!.expiresAt.getTime()).toBe(result.expiresAt.getTime());
  });

  it('calculates Retry-After from remaining window time', () => {
    const now = Date.parse('2026-07-14T10:00:30.000Z');
    const windowStart = Date.parse('2026-07-14T10:00:00.000Z');
    const windowMs = 60_000;

    expect(calculateRetryAfterSeconds(windowStart, windowMs, now)).toBe(30);
    expect(calculateRetryAfterSeconds(new Date(windowStart), windowMs, now)).toBe(30);
  });

  it('persists counters across store instances (shared Mongo state)', async () => {
    const clientIp = '198.51.100.4';
    const firstInstance = new MongoRateLimitStore('auth');
    const secondInstance = new MongoRateLimitStore('auth');

    await firstInstance.hit(clientIp, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS);
    await firstInstance.hit(clientIp, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS);

    const fromOther = await secondInstance.hit(
      clientIp,
      AUTH_RATE_LIMIT_MAX,
      AUTH_RATE_LIMIT_WINDOW_MS,
    );
    expect(fromOther.count).toBe(3);
    expect(fromOther.limited).toBe(false);
  });

  it('defines TTL index on expiresAt and unique compound index on (clientIp, bucket)', async () => {
    const indexes = await getRateLimitModel().collection.indexes();

    const ttlIndex = indexes.find(
      (index) =>
        index.expireAfterSeconds === 0 &&
        index.key &&
        (index.key as Record<string, number>).expiresAt === 1,
    );
    expect(ttlIndex).toBeDefined();

    const compound = indexes.find((index) => {
      const key = index.key as Record<string, number>;
      return key.clientIp === 1 && key.bucket === 1 && index.unique === true;
    });
    expect(compound).toBeDefined();
  });

  it('resets the counter after the window expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'));

    const clientIp = '198.51.100.5';
    const max = 2;
    const windowMs = 60_000;

    await store.hit(clientIp, max, windowMs);
    await store.hit(clientIp, max, windowMs);
    expect((await store.hit(clientIp, max, windowMs)).limited).toBe(true);

    vi.setSystemTime(new Date('2026-07-14T10:01:00.000Z'));

    const afterWindow = await store.hit(clientIp, max, windowMs);
    expect(afterWindow.limited).toBe(false);
    expect(afterWindow.count).toBe(1);

    vi.useRealTimers();
  });

  it('seeds fixtures with expected counts and timestamps', async () => {
    await getRateLimitModel().insertMany(rateLimitEntryFixtures);

    const fresh = await getRateLimitModel()
      .findOne({ clientIp: rateLimitFreshAuthFixture.clientIp, bucket: 'auth' })
      .lean()
      .exec();
    expect(fresh?.count).toBe(1);
    expect(fresh!.expiresAt.getTime() - fresh!.windowStart.getTime()).toBe(
      AUTH_RATE_LIMIT_WINDOW_MS,
    );

    const near = await getRateLimitModel()
      .findOne({ clientIp: rateLimitNearAuthLimitFixture.clientIp, bucket: 'auth' })
      .lean()
      .exec();
    expect(near?.count).toBe(AUTH_RATE_LIMIT_MAX - 1);

    const exceeded = await getRateLimitModel()
      .findOne({ clientIp: rateLimitExceededAuthFixture.clientIp, bucket: 'auth' })
      .lean()
      .exec();
    expect(exceeded?.count).toBe(AUTH_RATE_LIMIT_MAX + 1);
  });
});
