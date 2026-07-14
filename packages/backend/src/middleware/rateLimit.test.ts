import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createRateLimitMiddleware,
  createResetRateLimitStore,
  InMemoryRateLimitStore,
} from './rateLimit.js';
import { errorHandler } from './errorHandler.js';

describe('createRateLimitMiddleware', () => {
  const store = new InMemoryRateLimitStore();
  const reset = createResetRateLimitStore(store);

  afterEach(async () => {
    await reset();
  });

  it('returns 429 with Retry-After when the limit is exceeded', async () => {
    const app = express();
    app.use(
      createRateLimitMiddleware(
        {
          max: 2,
          windowMs: 60_000,
          message: 'Rate limit exceeded',
          suggestedAction: 'Slow down',
        },
        store,
      ),
    );
    app.get('/limited', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);

    expect((await request(app).get('/limited')).status).toBe(200);
    expect((await request(app).get('/limited')).status).toBe(200);

    const blocked = await request(app).get('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.message).toBe('Rate limit exceeded');
  });
});
