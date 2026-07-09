import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { type HealthCheckResponse } from '@autodev/shared-types';
import { createApp } from './index.js';

describe('GET /api/v1/health', () => {
  it('returns 200 with status and timestamp', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);

    const body = response.body as HealthCheckResponse;
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
  });
});
