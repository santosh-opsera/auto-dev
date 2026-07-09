import { describe, expect, it } from 'vitest';
import { errorResponseSchema, healthCheckSchema, dbHealthConnectedSchema, dbHealthDisconnectedSchema } from './index';

describe('healthCheckSchema', () => {
  it('validates a correct health check response', () => {
    const result = healthCheckSchema.safeParse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = healthCheckSchema.safeParse({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('errorResponseSchema', () => {
  it('validates structured error responses', () => {
    const result = errorResponseSchema.safeParse({
      error: 'ValidationError',
      message: 'Invalid payload',
      supportReferenceId: 'abc-123',
      suggestedAction: 'Fix the payload and retry.',
    });

    expect(result.success).toBe(true);
  });
});

describe('dbHealthConnectedSchema', () => {
  it('validates connected database health responses', () => {
    const result = dbHealthConnectedSchema.safeParse({
      status: 'connected',
      latencyMs: 12,
    });

    expect(result.success).toBe(true);
  });
});

describe('dbHealthDisconnectedSchema', () => {
  it('validates disconnected database health responses', () => {
    const result = dbHealthDisconnectedSchema.safeParse({
      status: 'disconnected',
      error: 'MongoDB is not connected',
    });

    expect(result.success).toBe(true);
  });
});
