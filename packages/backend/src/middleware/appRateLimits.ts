import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  STANDARD_RATE_LIMIT_MAX,
  STANDARD_RATE_LIMIT_WINDOW_MS,
} from '../auth/constants.js';
import { createRateLimitMiddleware, createResetRateLimitStore } from '../middleware/rateLimit.js';

const authRateLimitStore = new Map();
const standardRateLimitStore = new Map();

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
