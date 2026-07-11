import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { securityHeadersMiddleware } from './securityHeaders.js';

describe('securityHeadersMiddleware', () => {
  it('sets required security headers on responses', async () => {
    const app = express();
    app.use(securityHeadersMiddleware);
    app.get('/secure', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/secure');

    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });
});
