import { describe, expect, it } from 'vitest';
import {
  clampMaxTestFixIterations,
  chunkTestRequestSchema,
  chunkTestReportSchema,
  DEFAULT_MAX_TEST_FIX_ITERATIONS,
  generatedTestsDraftSchema,
  TEST_FIX_HARD_MAX_ITERATIONS,
  bugFixDraftSchema,
} from './testFix.js';
import {
  sampleBuggySourceFiles,
  sampleChunkTestReportFailed,
  sampleChunkTestReportPassed,
  sampleGeneratedTestsDraft,
  sampleSuccessfulBugFixDraft,
} from './fixtures/testFix.js';

describe('testFix schemas', () => {
  it('accepts chunk test request with optional maxIterations and sourceFiles', () => {
    expect(chunkTestRequestSchema.safeParse({}).success).toBe(true);
    expect(
      chunkTestRequestSchema.safeParse({
        maxIterations: 3,
        sourceFiles: sampleBuggySourceFiles,
      }).success,
    ).toBe(true);
  });

  it('rejects unbounded or over-cap maxIterations', () => {
    expect(chunkTestRequestSchema.safeParse({ maxIterations: 0 }).success).toBe(false);
    expect(
      chunkTestRequestSchema.safeParse({ maxIterations: TEST_FIX_HARD_MAX_ITERATIONS + 1 }).success,
    ).toBe(false);
  });

  it('clamps iterations to the hard ceiling and defaults to 5', () => {
    expect(DEFAULT_MAX_TEST_FIX_ITERATIONS).toBe(5);
    expect(clampMaxTestFixIterations()).toBe(5);
    expect(clampMaxTestFixIterations(100)).toBe(TEST_FIX_HARD_MAX_ITERATIONS);
    expect(clampMaxTestFixIterations(-1)).toBe(5);
  });

  it('validates generated tests and bug-fix drafts', () => {
    expect(generatedTestsDraftSchema.safeParse(sampleGeneratedTestsDraft).success).toBe(true);
    expect(bugFixDraftSchema.safeParse(sampleSuccessfulBugFixDraft).success).toBe(true);
    const kinds = sampleGeneratedTestsDraft.tests.map((test) => test.kind);
    expect(kinds).toContain('unit');
    expect(kinds).toContain('integration');
    expect(kinds).toContain('edge');
  });

  it('validates sample passed and failed reports', () => {
    expect(chunkTestReportSchema.safeParse(sampleChunkTestReportPassed).success).toBe(true);
    expect(chunkTestReportSchema.safeParse(sampleChunkTestReportFailed).success).toBe(true);
    expect(sampleChunkTestReportFailed.failureReport?.iterationsExhausted).toBe(5);
  });
});
