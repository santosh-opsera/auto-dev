import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from './errorHandler.js';
import {
  calculateRetryAfterSeconds,
  type RateLimitStore,
} from './mongoRateLimitStore.js';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  message?: string;
  suggestedAction?: string;
}

interface InMemoryRateLimitEntry {
  count: number;
  windowStart: number;
}

/** In-memory fixed-window store for unit tests of the middleware factory. */
export class InMemoryRateLimitStore implements RateLimitStore {
  constructor(private readonly entries = new Map<string, InMemoryRateLimitEntry>()) {}

  async hit(clientIp: string, max: number, windowMs: number) {
    const now = Date.now();
    const entry = this.entries.get(clientIp) ?? { count: 0, windowStart: now };

    if (now - entry.windowStart >= windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count += 1;
    this.entries.set(clientIp, entry);

    return {
      limited: entry.count > max,
      count: entry.count,
      retryAfterSeconds: calculateRetryAfterSeconds(entry.windowStart, windowMs, now),
      windowStart: new Date(entry.windowStart),
      expiresAt: new Date(entry.windowStart + windowMs),
    };
  }

  async reset(): Promise<void> {
    this.entries.clear();
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions, store: RateLimitStore) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientIp = req.ip ?? 'unknown';
    const result = await store.hit(clientIp, options.max, options.windowMs);

    if (result.limited) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
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
  });
}

export function createResetRateLimitStore(store: RateLimitStore): () => Promise<void> {
  return () => store.reset();
}
