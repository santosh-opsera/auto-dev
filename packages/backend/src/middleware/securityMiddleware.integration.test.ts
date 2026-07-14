import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../index.js';
import { ensureIndexes } from '../database/indexes.js';
import { getRateLimitModel } from '../models/rateLimitModel.js';
import { resetStandardRateLimits } from './appRateLimits.js';
import {
  createRateLimitMiddleware,
  InMemoryRateLimitStore,
} from './rateLimit.js';
import { MongoRateLimitStore, resetAllRateLimits } from './mongoRateLimitStore.js';
import { securityHeadersMiddleware } from './securityHeaders.js';
import { errorHandler } from './errorHandler.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

describe('security middleware integration', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getRateLimitModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  afterEach(async () => {
    await resetStandardRateLimits();
    await resetAllRateLimits();
  });

  it('returns 429 with Retry-After after exceeding the standard rate limit', async () => {
    const store = new InMemoryRateLimitStore();
    const app = express();
    app.use(securityHeadersMiddleware);
    app.use(createRateLimitMiddleware({ max: 3, windowMs: 60_000 }, store));
    app.get('/api/v1/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    app.use(errorHandler);

    await request(app).get('/api/v1/health');
    await request(app).get('/api/v1/health');
    await request(app).get('/api/v1/health');

    const blocked = await request(app).get('/api/v1/health');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['x-frame-options']).toBe('DENY');
  });

  it('exposes validation and security headers on the test app', async () => {
    const app = createApp();

    const health = await request(app).get('/api/v1/health');
    expect(health.headers['content-security-policy']).toBeDefined();
    expect(health.headers['x-content-type-options']).toBe('nosniff');

    const invalid = await request(app)
      .post('/api/v1/test/validate')
      .send({ name: '', branchPattern: '[', reviewers: [] });

    expect(invalid.status).toBe(400);
    expect(invalid.body.fields?.length).toBeGreaterThan(0);
    expect(JSON.stringify(invalid.body)).not.toContain('/packages/backend');
  });

  it('returns 429 after threshold using mongodb-memory-server', async () => {
    const store = new MongoRateLimitStore('integration');
    await store.reset();

    const app = express();
    app.set('trust proxy', true);
    app.use(createRateLimitMiddleware({ max: 3, windowMs: 60_000 }, store));
    app.get('/limited', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);

    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.10');
    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.10');
    await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.10');

    const blocked = await request(app)
      .get('/limited')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();

    const stored = await getRateLimitModel()
      .findOne({ clientIp: '203.0.113.10', bucket: 'integration' })
      .lean()
      .exec();
    expect(stored?.count).toBe(4);
  });
});
