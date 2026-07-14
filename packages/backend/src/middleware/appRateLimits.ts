import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  STANDARD_RATE_LIMIT_MAX,
  STANDARD_RATE_LIMIT_WINDOW_MS,
} from '../auth/constants.js';
import { createRateLimitMiddleware, createResetRateLimitStore } from '../middleware/rateLimit.js';
import { MongoRateLimitStore } from '../middleware/mongoRateLimitStore.js';

export const AUTH_RATE_LIMIT_BUCKET = 'auth';
export const STANDARD_RATE_LIMIT_BUCKET = 'standard';

const authRateLimitStore = new MongoRateLimitStore(AUTH_RATE_LIMIT_BUCKET);
const standardRateLimitStore = new MongoRateLimitStore(STANDARD_RATE_LIMIT_BUCKET);

export const authRateLimitMiddleware = createRateLimitMiddleware(
  {
    max: AUTH_RATE_LIMIT_MAX,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    message: 'Too many authentication requests. Please try again later.',
    suggestedAction: 'Wait before retrying authentication.',
  },
  authRateLimitStore,
);

export const standardRateLimitMiddleware = createRateLimitMiddleware(
  {
    max: STANDARD_RATE_LIMIT_MAX,
    windowMs: STANDARD_RATE_LIMIT_WINDOW_MS,
    message: 'Too many requests. Please try again later.',
    suggestedAction: 'Wait before retrying.',
  },
  standardRateLimitStore,
);

export const resetAuthRateLimits = createResetRateLimitStore(authRateLimitStore);
export const resetStandardRateLimits = createResetRateLimitStore(standardRateLimitStore);
