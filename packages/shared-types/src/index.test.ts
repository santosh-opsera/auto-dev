import { describe, expect, it } from 'vitest';
import { healthCheckSchema } from './index';

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
