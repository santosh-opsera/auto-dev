import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  STANDARD_RATE_LIMIT_MAX,
  STANDARD_RATE_LIMIT_WINDOW_MS,
} from '../auth/constants.js';

export interface RateLimitEntryFixture {
  clientIp: string;
  bucket: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
  dataClassification: 'internal';
}

const FIXED_NOW = new Date('2026-07-14T10:00:00.000Z');

/** Fresh auth window with a single counted request. */
export const rateLimitFreshAuthFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.10',
  bucket: 'auth',
  count: 1,
  windowStart: FIXED_NOW,
  expiresAt: new Date(FIXED_NOW.getTime() + AUTH_RATE_LIMIT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Auth bucket one under the limit — next request should still be allowed. */
export const rateLimitNearAuthLimitFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.20',
  bucket: 'auth',
  count: AUTH_RATE_LIMIT_MAX - 1,
  windowStart: new Date(FIXED_NOW.getTime() - 10_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 10_000 + AUTH_RATE_LIMIT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Auth bucket already at/over limit within the current window. */
export const rateLimitExceededAuthFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.30',
  bucket: 'auth',
  count: AUTH_RATE_LIMIT_MAX + 1,
  windowStart: new Date(FIXED_NOW.getTime() - 5_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 5_000 + AUTH_RATE_LIMIT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Expired auth window — TTL should remove; counter should reset on next hit. */
export const rateLimitExpiredAuthFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.40',
  bucket: 'auth',
  count: AUTH_RATE_LIMIT_MAX,
  windowStart: new Date(FIXED_NOW.getTime() - AUTH_RATE_LIMIT_WINDOW_MS - 60_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 60_000),
  dataClassification: 'internal',
};

/** Standard bucket with modest traffic in an open window. */
export const rateLimitPartialStandardFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.50',
  bucket: 'standard',
  count: 42,
  windowStart: new Date(FIXED_NOW.getTime() - 20_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 20_000 + STANDARD_RATE_LIMIT_WINDOW_MS),
  dataClassification: 'internal',
};

/** Standard bucket near its higher ceiling. */
export const rateLimitNearStandardLimitFixture: RateLimitEntryFixture = {
  clientIp: '192.0.2.60',
  bucket: 'standard',
  count: STANDARD_RATE_LIMIT_MAX - 1,
  windowStart: new Date(FIXED_NOW.getTime() - 15_000),
  expiresAt: new Date(FIXED_NOW.getTime() - 15_000 + STANDARD_RATE_LIMIT_WINDOW_MS),
  dataClassification: 'internal',
};

export const rateLimitEntryFixtures: RateLimitEntryFixture[] = [
  rateLimitFreshAuthFixture,
  rateLimitNearAuthLimitFixture,
  rateLimitExceededAuthFixture,
  rateLimitExpiredAuthFixture,
  rateLimitPartialStandardFixture,
  rateLimitNearStandardLimitFixture,
];

export const RATE_LIMIT_FIXTURE_NOW = FIXED_NOW;
