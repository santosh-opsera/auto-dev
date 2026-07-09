import type { NextFunction, Request, Response } from 'express';
import { AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS } from './constants.js';
import { AppError } from '../utils/errors.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function resetAuthRateLimits(): void {
  rateLimits.clear();
}

export function authRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = rateLimits.get(key) ?? { count: 0, windowStart: now };

  if (now - entry.windowStart >= AUTH_RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateLimits.set(key, entry);

  if (entry.count > AUTH_RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil(
      (AUTH_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000,
    );
    res.setHeader('Retry-After', String(retryAfterSeconds));
    next(
      new AppError(
        'TooManyRequests',
        'Too many authentication requests. Please try again later.',
        429,
        'Wait before retrying authentication.',
      ),
    );
    return;
  }

  next();
}
