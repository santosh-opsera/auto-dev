import {
  buildRateLimitExpiry,
  getRateLimitModel,
  type RateLimitDocument,
} from '../models/rateLimitModel.js';

export interface RateLimitHitResult {
  /** True when the request should be rejected (count exceeded max). */
  limited: boolean;
  count: number;
  retryAfterSeconds: number;
  windowStart: Date;
  expiresAt: Date;
}

export interface RateLimitStore {
  hit(clientIp: string, max: number, windowMs: number): Promise<RateLimitHitResult>;
  reset(): Promise<void>;
}

function toMillis(value: Date | number): number {
  return typeof value === 'number' ? value : value.getTime();
}

function calculateRetryAfterSeconds(
  windowStart: Date | number,
  windowMs: number,
  now: number,
): number {
  const elapsed = now - toMillis(windowStart);
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

/**
 * MongoDB-backed fixed-window rate limit counter, shared across instances.
 * Documents expire via TTL on `expiresAt` once the window ends.
 */
export class MongoRateLimitStore implements RateLimitStore {
  constructor(private readonly bucket: string) {}

  async hit(clientIp: string, max: number, windowMs: number): Promise<RateLimitHitResult> {
    const now = Date.now();
    const model = getRateLimitModel();
    const existing = await model.findOne({ clientIp, bucket: this.bucket }).lean().exec();

    const windowExpired =
      !existing || now - existing.windowStart.getTime() >= windowMs;

    if (windowExpired) {
      const windowStart = new Date(now);
      const expiresAt = buildRateLimitExpiry(windowStart, windowMs);
      const doc = await model
        .findOneAndUpdate(
          { clientIp, bucket: this.bucket },
          {
            $set: {
              count: 1,
              windowStart,
              expiresAt,
              dataClassification: 'internal',
            },
            $setOnInsert: { clientIp, bucket: this.bucket },
          },
          { upsert: true, returnDocument: 'after' },
        )
        .exec();

      return this.toResult(doc!, max, windowMs, now);
    }

    const doc = await model
      .findOneAndUpdate(
        { clientIp, bucket: this.bucket },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!doc) {
      // Rare race: document deleted between read and increment — start a fresh window.
      return this.hit(clientIp, max, windowMs);
    }

    return this.toResult(doc, max, windowMs, now);
  }

  async reset(): Promise<void> {
    await getRateLimitModel().deleteMany({ bucket: this.bucket }).exec();
  }

  private toResult(
    doc: Pick<RateLimitDocument, 'count' | 'windowStart' | 'expiresAt'>,
    max: number,
    windowMs: number,
    now: number,
  ): RateLimitHitResult {
    return {
      limited: doc.count > max,
      count: doc.count,
      retryAfterSeconds: calculateRetryAfterSeconds(doc.windowStart, windowMs, now),
      windowStart: doc.windowStart,
      expiresAt: doc.expiresAt,
    };
  }
}

/** Clears all rate limit buckets — test helper. */
export async function resetAllRateLimits(): Promise<void> {
  await getRateLimitModel().deleteMany({}).exec();
}

export { calculateRetryAfterSeconds };
