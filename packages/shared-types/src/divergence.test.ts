import { describe, expect, it } from 'vitest';
import { divergenceDetectionResponseSchema, divergenceSchema } from './divergence.js';
import { sampleExpectedNamingDivergence } from './fixtures/divergence.js';

describe('divergence schemas', () => {
  it('validates divergence objects', () => {
    expect(divergenceSchema.safeParse(sampleExpectedNamingDivergence).success).toBe(true);
  });

  it('validates divergence detection responses', () => {
    const result = divergenceDetectionResponseSchema.safeParse({
      ticketKey: 'OPL-3002',
      workflowId: 'workflow-001',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      divergences: [sampleExpectedNamingDivergence],
      aligned: false,
      summary: 'Detected 1 divergence(s): 1 naming.',
      persistedId: '64b1f9f9f9f9f9f9f9f9f9f9',
      ticketIntentId: '64b1f9f9f9f9f9f9f9f9f9f9f0',
      codebaseContextId: '64b1f9f9f9f9f9f9f9f9f9f9f1',
    });

    expect(result.success).toBe(true);
  });
});
