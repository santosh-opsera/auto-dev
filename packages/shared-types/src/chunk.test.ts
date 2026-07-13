import { describe, expect, it } from 'vitest';
import {
  canTransitionChunkStatus,
  chunkDecomposeRequestSchema,
  chunkDecompositionDraftSchema,
  chunkListResponseSchema,
  chunkStatusSchema,
  chunkStatusUpdateRequestSchema,
  implementationChunkResponseSchema,
} from './chunk.js';
import {
  sampleChunkDecompositionDraft,
  sampleImplementationChunks,
} from './fixtures/chunk.js';

describe('chunk schemas', () => {
  it('validates chunk statuses and requests', () => {
    expect(chunkStatusSchema.options).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'FAILED',
      'PAUSED',
      'SKIPPED',
    ]);
    expect(chunkDecomposeRequestSchema.safeParse({ prdId: 'prd-1' }).success).toBe(true);
    expect(chunkDecomposeRequestSchema.safeParse({ prdId: '' }).success).toBe(false);
    expect(chunkStatusUpdateRequestSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
    expect(chunkStatusUpdateRequestSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('validates decomposition drafts and response fixtures', () => {
    expect(chunkDecompositionDraftSchema.safeParse(sampleChunkDecompositionDraft).success).toBe(
      true,
    );
    expect(
      implementationChunkResponseSchema.safeParse(sampleImplementationChunks[0]).success,
    ).toBe(true);
    expect(
      chunkListResponseSchema.safeParse({ chunks: sampleImplementationChunks }).success,
    ).toBe(true);
    expect(sampleImplementationChunks[1]?.dependencies).toEqual(['chunk-001']);
  });

  it('enforces allowed status transitions', () => {
    expect(canTransitionChunkStatus('PENDING', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionChunkStatus('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransitionChunkStatus('IN_PROGRESS', 'PAUSED')).toBe(true);
    expect(canTransitionChunkStatus('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionChunkStatus('SKIPPED', 'PENDING')).toBe(false);
  });
});
