import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../index.js';
import { resetStandardRateLimits } from './appRateLimits.js';
import { createRateLimitMiddleware } from './rateLimit.js';
import { securityHeadersMiddleware } from './securityHeaders.js';
import { errorHandler } from './errorHandler.js';

describe('security middleware integration', () => {
  afterEach(() => {
    resetStandardRateLimits();
  });

  it('returns 429 with Retry-After after exceeding the standard rate limit', async () => {
    const store = new Map();
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
});
