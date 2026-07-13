import type {
  CoverageMetrics,
  FailureReport,
  GeneratedTest,
  TestFramework,
  TestIterationLog,
  TestReportStatus,
  TestRunResult,
} from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface ChunkTestReportDocument extends AuditFields {
  userId: string;
  workflowDocumentId: string;
  workflowId: string;
  chunkId: string;
  status: TestReportStatus;
  framework: TestFramework;
  maxIterations: number;
  iterationsUsed: number;
  generatedTests: GeneratedTest[];
  iterations: TestIterationLog[];
  coverage: CoverageMetrics;
  failureReport?: FailureReport;
  finalTestResults?: TestRunResult;
  sourceFilesSnapshot: Record<string, string>;
}

export type ChunkTestReportRecord = HydratedDocument<ChunkTestReportDocument>;

const generatedTestSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['unit', 'integration', 'edge'], required: true },
    filePath: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const testCaseResultSubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ['passed', 'failed', 'skipped'], required: true },
    errorMessage: { type: String, required: false },
    stackTrace: { type: String, required: false },
    durationMs: { type: Number, required: false },
  },
  { _id: false },
);

const testRunResultSubSchema = new mongoose.Schema(
  {
    passed: { type: Boolean, required: true },
    results: { type: [testCaseResultSubSchema], required: true, default: [] },
    passedCount: { type: Number, required: true },
    failedCount: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    framework: {
      type: String,
      enum: ['vitest', 'jest', 'mocha', 'unknown'],
      required: true,
    },
  },
  { _id: false },
);

const appliedFixSubSchema = new mongoose.Schema(
  {
    filePath: { type: String, required: true },
    summary: { type: String, required: true },
    beforeSnippet: { type: String, required: false },
    afterSnippet: { type: String, required: false },
  },
  { _id: false },
);

const iterationLogSubSchema = new mongoose.Schema(
  {
    iteration: { type: Number, required: true },
    testResults: { type: testRunResultSubSchema, required: true },
    identifiedIssues: { type: [String], required: true, default: [] },
    appliedFixes: { type: [appliedFixSubSchema], required: true, default: [] },
    retestResults: { type: testRunResultSubSchema, required: false },
    loggedAt: { type: String, required: true },
  },
  { _id: false },
);

const coverageSubSchema = new mongoose.Schema(
  {
    lines: { type: Number, required: true },
    branches: { type: Number, required: true },
    functions: { type: Number, required: true },
    statements: { type: Number, required: true },
    overallPercent: { type: Number, required: true },
  },
  { _id: false },
);

const failureReportSubSchema = new mongoose.Schema(
  {
    failingTests: { type: [testCaseResultSubSchema], required: true, default: [] },
    attemptedFixes: { type: [appliedFixSubSchema], required: true, default: [] },
    rootCauseAnalysis: { type: String, required: true },
    iterationsExhausted: { type: Number, required: true },
    maxIterations: { type: Number, required: true },
  },
  { _id: false },
);

const chunkTestReportSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowDocumentId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  chunkId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['passed', 'failed', 'running'],
    required: true,
    default: 'running',
  },
  framework: {
    type: String,
    enum: ['vitest', 'jest', 'mocha', 'unknown'],
    required: true,
  },
  maxIterations: { type: Number, required: true },
  iterationsUsed: { type: Number, required: true, default: 0 },
  generatedTests: { type: [generatedTestSubSchema], required: true, default: [] },
  iterations: { type: [iterationLogSubSchema], required: true, default: [] },
  coverage: { type: coverageSubSchema, required: true },
  failureReport: { type: failureReportSubSchema, required: false },
  finalTestResults: { type: testRunResultSubSchema, required: false },
  // Mixed (not Map): file paths contain dots (e.g. src/math/add.ts) which break Map key casting.
  sourceFilesSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
});

chunkTestReportSchema.index({ userId: 1, chunkId: 1, createdAt: -1 });
chunkTestReportSchema.index({ userId: 1, workflowDocumentId: 1, chunkId: 1 });

export function getChunkTestReportModel(): Model<ChunkTestReportDocument> {
  if (mongoose.models.ChunkTestReportDocument) {
    return mongoose.models.ChunkTestReportDocument as Model<ChunkTestReportDocument>;
  }

  return mongoose.model<ChunkTestReportDocument>(
    'ChunkTestReportDocument',
    chunkTestReportSchema,
    'chunk_test_reports',
  );
}
