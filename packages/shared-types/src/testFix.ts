import { z } from 'zod';

/** Hard ceiling — callers may configure lower; loops must never be unbounded. */
export const TEST_FIX_HARD_MAX_ITERATIONS = 20;
export const DEFAULT_MAX_TEST_FIX_ITERATIONS = 5;

export const TEST_KINDS = ['unit', 'integration', 'edge'] as const;
export const testKindSchema = z.enum(TEST_KINDS);
export type TestKind = z.infer<typeof testKindSchema>;

export const TEST_FRAMEWORKS = ['vitest', 'jest', 'mocha', 'unknown'] as const;
export const testFrameworkSchema = z.enum(TEST_FRAMEWORKS);
export type TestFramework = z.infer<typeof testFrameworkSchema>;

export const TEST_CASE_STATUSES = ['passed', 'failed', 'skipped'] as const;
export const testCaseStatusSchema = z.enum(TEST_CASE_STATUSES);
export type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;

export const TEST_REPORT_STATUSES = ['passed', 'failed', 'running'] as const;
export const testReportStatusSchema = z.enum(TEST_REPORT_STATUSES);
export type TestReportStatus = z.infer<typeof testReportStatusSchema>;

export const generatedTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: testKindSchema,
  filePath: z.string().min(1),
  content: z.string().min(1),
});

export type GeneratedTest = z.infer<typeof generatedTestSchema>;

export const testCaseResultSchema = z.object({
  name: z.string().min(1),
  status: testCaseStatusSchema,
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export type TestCaseResult = z.infer<typeof testCaseResultSchema>;

export const testRunResultSchema = z.object({
  passed: z.boolean(),
  results: z.array(testCaseResultSchema),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  framework: testFrameworkSchema,
});

export type TestRunResult = z.infer<typeof testRunResultSchema>;

export const appliedFixSchema = z.object({
  filePath: z.string().min(1),
  summary: z.string().min(1),
  beforeSnippet: z.string().optional(),
  afterSnippet: z.string().optional(),
});

export type AppliedFix = z.infer<typeof appliedFixSchema>;

export const testIterationLogSchema = z.object({
  iteration: z.number().int().positive(),
  testResults: testRunResultSchema,
  identifiedIssues: z.array(z.string()),
  appliedFixes: z.array(appliedFixSchema),
  retestResults: testRunResultSchema.optional(),
  loggedAt: z.string().datetime(),
});

export type TestIterationLog = z.infer<typeof testIterationLogSchema>;

export const coverageMetricsSchema = z.object({
  lines: z.number().min(0).max(100),
  branches: z.number().min(0).max(100),
  functions: z.number().min(0).max(100),
  statements: z.number().min(0).max(100),
  /** Stubbed overall percentage for the chunk under test. */
  overallPercent: z.number().min(0).max(100),
});

export type CoverageMetrics = z.infer<typeof coverageMetricsSchema>;

export const failureReportSchema = z.object({
  failingTests: z.array(testCaseResultSchema),
  attemptedFixes: z.array(appliedFixSchema),
  rootCauseAnalysis: z.string().min(1),
  iterationsExhausted: z.number().int().positive(),
  maxIterations: z.number().int().positive(),
});

export type FailureReport = z.infer<typeof failureReportSchema>;

export const chunkTestRequestSchema = z.object({
  maxIterations: z
    .number()
    .int()
    .positive()
    .max(TEST_FIX_HARD_MAX_ITERATIONS)
    .optional(),
  sourceFiles: z.record(z.string(), z.string()).optional(),
});

export type ChunkTestRequest = z.infer<typeof chunkTestRequestSchema>;

export const chunkTestReportSchema = z.object({
  id: z.string().min(1),
  workflowDocumentId: z.string().min(1),
  workflowId: z.string().min(1),
  chunkId: z.string().min(1),
  status: testReportStatusSchema,
  framework: testFrameworkSchema,
  maxIterations: z.number().int().positive(),
  iterationsUsed: z.number().int().nonnegative(),
  generatedTests: z.array(generatedTestSchema),
  iterations: z.array(testIterationLogSchema),
  coverage: coverageMetricsSchema,
  failureReport: failureReportSchema.optional(),
  finalTestResults: testRunResultSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChunkTestReport = z.infer<typeof chunkTestReportSchema>;

export const chunkTestResponseSchema = z.object({
  report: chunkTestReportSchema,
});

export type ChunkTestResponse = z.infer<typeof chunkTestResponseSchema>;

export const chunkTestReportResponseSchema = chunkTestResponseSchema;
export type ChunkTestReportResponse = ChunkTestResponse;

/** LLM draft for generated tests before persistence. */
export const generatedTestsDraftSchema = z.object({
  framework: testFrameworkSchema.optional(),
  tests: z.array(generatedTestSchema.omit({ id: true }).extend({ id: z.string().min(1).optional() })).min(1),
});

export type GeneratedTestsDraft = z.infer<typeof generatedTestsDraftSchema>;

/** LLM draft for a single bug-fix iteration. */
export const bugFixDraftSchema = z.object({
  identifiedIssues: z.array(z.string()).min(1),
  fixes: z
    .array(
      z.object({
        filePath: z.string().min(1),
        summary: z.string().min(1),
        replacementContent: z.string().min(1),
        beforeSnippet: z.string().optional(),
        afterSnippet: z.string().optional(),
      }),
    )
    .min(1),
  rootCauseAnalysis: z.string().min(1).optional(),
});

export type BugFixDraft = z.infer<typeof bugFixDraftSchema>;

export function clampMaxTestFixIterations(requested?: number): number {
  const value = requested ?? DEFAULT_MAX_TEST_FIX_ITERATIONS;
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_TEST_FIX_ITERATIONS;
  }
  return Math.min(Math.floor(value), TEST_FIX_HARD_MAX_ITERATIONS);
}
