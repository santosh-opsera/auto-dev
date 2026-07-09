import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { type ErrorResponse, type HealthCheckResponse, errorResponseSchema } from '@autodev/shared-types';
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

  it('returns a correlation ID header', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/health')
      .set('X-Correlation-ID', 'health-check-correlation');

    expect(response.headers['x-correlation-id']).toBe('health-check-correlation');
  });
});

describe('error handling integration', () => {
  it('handles unhandled exceptions with structured 500 responses', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/test/error');

    expect(response.status).toBe(500);
    expect(errorResponseSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain('/app/src');
  });

  it('handles AppError with structured client responses', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/test/app-error');
    const body = response.body as ErrorResponse;

    expect(response.status).toBe(400);
    expect(body.error).toBe('ValidationError');
    expect(body.suggestedAction).toContain('request fields');
  });
});
