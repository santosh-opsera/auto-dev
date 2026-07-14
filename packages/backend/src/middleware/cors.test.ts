import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { corsMiddleware } from './cors.js';

describe('corsMiddleware', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('allows configured frontend origin and handles preflight', async () => {
    process.env.FRONTEND_URL = 'http://localhost:3001';

    const app = express();
    app.use(corsMiddleware);
    app.get('/resource', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const preflight = await request(app)
      .options('/resource')
      .set('Origin', 'http://localhost:3001');

    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    const response = await request(app)
      .get('/resource')
      .set('Origin', 'http://localhost:3001');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });

  it('does not reflect disallowed origins', async () => {
    process.env.FRONTEND_URL = 'http://localhost:3001';

    const app = express();
    app.use(corsMiddleware);
    app.get('/resource', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get('/resource')
      .set('Origin', 'http://evil.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
