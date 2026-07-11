import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  message?: string;
  suggestedAction?: string;
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
  store = new Map<string, RateLimitEntry>(),
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = store.get(key) ?? { count: 0, windowStart: now };

    if (now - entry.windowStart >= options.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count += 1;
    store.set(key, entry);

    if (entry.count > options.max) {
      const retryAfterSeconds = Math.ceil(
        (options.windowMs - (now - entry.windowStart)) / 1000,
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        new AppError(
          'TooManyRequests',
          options.message ?? 'Too many requests. Please try again later.',
          429,
          options.suggestedAction ?? 'Wait before retrying.',
        ),
      );
      return;
    }

    next();
  };
}

export function createResetRateLimitStore(store: Map<string, RateLimitEntry>): () => void {
  return () => {
    store.clear();
  };
}
