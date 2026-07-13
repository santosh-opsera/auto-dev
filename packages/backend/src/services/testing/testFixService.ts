import { randomUUID } from 'node:crypto';
import {
  clampMaxTestFixIterations,
  type AppliedFix,
  type ChunkTestReport,
  type ChunkTestRequest,
  type ChunkTestResponse,
  type CoverageMetrics,
  type FailureReport,
  type GeneratedTest,
  type TestFramework,
  type TestIterationLog,
  type TestRunResult,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getChunkTestReportModel,
  type ChunkTestReportRecord,
} from '../../models/chunkTestReportModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import {
  getImplementationChunkModel,
  type ImplementationChunkRecord,
} from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '../events/eventBus.js';
import { llmAdapter } from '../llm/llmAdapter.js';
import type { LlmAdapter } from '../llm/llmTypes.js';
import {
  detectTestFrameworkFromContext,
  resolveTestFileNamingPattern,
} from './testFrameworkDetector.js';
import {
  normalizeGeneratedTests,
  parseBugFixLlmOutput,
  parseGeneratedTestsLlmOutput,
} from './testParser.js';
import { buildBugFixPrompt, buildTestGenerationPrompt, summarizeRunForLog } from './testPromptBuilder.js';
import type { TestRunner } from './testRunner.js';
import { VitestRunner } from './vitestRunner.js';

const TEST_SYSTEM_PROMPT =
  'You are AutoDev test generation and bug-fix engine. Always respond with valid JSON only.';

function clonePlain<T>(value: T): T {
  // Mongoose subdocuments do not spread correctly — serialize to plain JSON.
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapReport(doc: ChunkTestReportRecord): ChunkTestReport {
  const report: ChunkTestReport = {
    id: doc._id.toString(),
    workflowDocumentId: doc.workflowDocumentId,
    workflowId: doc.workflowId,
    chunkId: doc.chunkId,
    status: doc.status,
    framework: doc.framework,
    maxIterations: doc.maxIterations,
    iterationsUsed: doc.iterationsUsed,
    generatedTests: clonePlain(doc.generatedTests),
    iterations: clonePlain(doc.iterations),
    coverage: clonePlain(doc.coverage),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (doc.failureReport) {
    report.failureReport = clonePlain(doc.failureReport);
  }

  if (doc.finalTestResults) {
    report.finalTestResults = clonePlain(doc.finalTestResults);
  }

  return report;
}

/** Stubbed coverage metrics derived from pass rate (not a real coverage tool). */
export function stubCoverageMetrics(run: TestRunResult, testCount: number): CoverageMetrics {
  const total = Math.max(testCount, run.results.length, 1);
  const passRatio = run.passedCount / total;
  const overallPercent = Number((passRatio * 100).toFixed(2));
  return {
    lines: Number((overallPercent * 0.95).toFixed(2)),
    branches: Number((overallPercent * 0.85).toFixed(2)),
    functions: Number((overallPercent * 0.9).toFixed(2)),
    statements: Number((overallPercent * 0.92).toFixed(2)),
    overallPercent,
  };
}

export function buildFailureReport(input: {
  finalRun: TestRunResult;
  iterations: TestIterationLog[];
  maxIterations: number;
  rootCauseAnalysis?: string;
}): FailureReport {
  const attemptedFixes = input.iterations.flatMap((iteration) => iteration.appliedFixes);
  const failingTests = input.finalRun.results.filter((result) => result.status === 'failed');
  const rootCauseAnalysis =
    input.rootCauseAnalysis?.trim() ||
    [
      `Exhausted ${input.maxIterations} bug-fix iteration(s) without all tests passing.`,
      `${failingTests.length} test(s) still failing.`,
      attemptedFixes.length > 0
        ? `Attempted ${attemptedFixes.length} fix(es) across logged iterations.`
        : 'No successful fixes were applied.',
    ].join(' ');

  return {
    failingTests,
    attemptedFixes,
    rootCauseAnalysis,
    iterationsExhausted: input.maxIterations,
    maxIterations: input.maxIterations,
  };
}

export class TestFixService {
  constructor(
    private readonly llm: LlmAdapter = llmAdapter,
    private readonly runner: TestRunner = new VitestRunner(),
  ) {}

  async runForChunk(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: ChunkTestRequest = {},
  ): Promise<ChunkTestResponse> {
    const maxIterations = clampMaxTestFixIterations(input.maxIterations);
    const { workflow, chunk, acceptanceCriteria, framework, namingPattern } =
      await this.loadContext(user, workflowDocumentId, chunkId);

    const sourceFiles = {
      ...(input.sourceFiles ?? this.defaultSourceFilesFromChunk(chunk)),
    };

    const generatedTests = await this.generateTests({
      acceptanceCriteria,
      sourceFiles,
      framework,
      namingPattern,
      chunkName: chunk.name,
      chunkDescription: chunk.description,
    });

    const reportDoc = await getChunkTestReportModel().create({
      userId: String(user._id),
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      chunkId: chunk._id.toString(),
      status: 'running',
      framework,
      maxIterations,
      iterationsUsed: 0,
      generatedTests,
      iterations: [],
      coverage: stubCoverageMetrics(
        {
          passed: false,
          results: [],
          passedCount: 0,
          failedCount: 0,
          durationMs: 0,
          framework,
        },
        generatedTests.length,
      ),
      sourceFilesSnapshot: sourceFiles,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      dataClassification: 'internal',
    });

    await eventBus.publish(
      {
        type: 'TESTING_STARTED',
        payload: {
          workflowId: workflow.workflowId,
          chunkId: chunk._id.toString(),
          maxIterations,
          framework,
          testCount: generatedTests.length,
        },
        metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
      },
      { awaitHandlers: true },
    );

    const iterations: TestIterationLog[] = [];
    let workingSources = { ...sourceFiles };
    let lastRun: TestRunResult | undefined;
    let lastRootCause: string | undefined;
    let passed = false;

    // Bounded for-loop only — never while(true) / unbounded retries.
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const testResults = await this.runner.run({
        tests: generatedTests,
        sourceFiles: workingSources,
      });
      lastRun = testResults;

      logger.info(
        `Testing iteration ${iteration}/${maxIterations}: ${summarizeRunForLog(testResults)}`,
        {
          actor: String(user._id),
          resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/test`,
          operation: 'TESTING_ITERATION',
        },
      );

      if (testResults.passed) {
        const log: TestIterationLog = {
          iteration,
          testResults,
          identifiedIssues: [],
          appliedFixes: [],
          loggedAt: new Date().toISOString(),
        };
        iterations.push(log);
        passed = true;

        await eventBus.publish(
          {
            type: 'TESTING_ITERATION',
            payload: {
              workflowId: workflow.workflowId,
              chunkId: chunk._id.toString(),
              iteration,
              maxIterations,
              passed: true,
              failedCount: 0,
              identifiedIssues: [],
              fixesApplied: 0,
            },
            metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
          },
          { awaitHandlers: true },
        );
        break;
      }

      const failingTests = testResults.results.filter((result) => result.status === 'failed');
      const { appliedFixes, identifiedIssues, rootCauseAnalysis, nextSources } =
        await this.analyzeAndApplyFix({
          failingTests,
          sourceFiles: workingSources,
          iteration,
          maxIterations,
          generatedTests,
        });

      workingSources = nextSources;
      lastRootCause = rootCauseAnalysis;

      const retestResults = await this.runner.run({
        tests: generatedTests,
        sourceFiles: workingSources,
      });
      lastRun = retestResults;

      const log: TestIterationLog = {
        iteration,
        testResults,
        identifiedIssues,
        appliedFixes,
        retestResults,
        loggedAt: new Date().toISOString(),
      };
      iterations.push(log);

      await eventBus.publish(
        {
          type: 'TESTING_ITERATION',
          payload: {
            workflowId: workflow.workflowId,
            chunkId: chunk._id.toString(),
            iteration,
            maxIterations,
            passed: retestResults.passed,
            failedCount: retestResults.failedCount,
            identifiedIssues,
            fixesApplied: appliedFixes.length,
          },
          metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
        },
        { awaitHandlers: true },
      );

      logger.info(
        `Testing iteration ${iteration} retest: ${summarizeRunForLog(retestResults)}; issues=${identifiedIssues.length}; fixes=${appliedFixes.length}`,
        {
          actor: String(user._id),
          resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/test`,
          operation: 'TESTING_ITERATION',
        },
      );

      if (retestResults.passed) {
        passed = true;
        break;
      }
    }

    const iterationsUsed = iterations.length;
    const finalTestResults =
      lastRun ??
      ({
        passed: false,
        results: [],
        passedCount: 0,
        failedCount: generatedTests.length,
        durationMs: 0,
        framework,
      } satisfies TestRunResult);

    const coverage = stubCoverageMetrics(finalTestResults, generatedTests.length);
    let failureReport: FailureReport | undefined;

    if (passed) {
      reportDoc.status = 'passed';
      await eventBus.publish(
        {
          type: 'TESTING_PASSED',
          payload: {
            workflowId: workflow.workflowId,
            chunkId: chunk._id.toString(),
            iterationsUsed,
            coveragePercent: coverage.overallPercent,
            passedCount: finalTestResults.passedCount,
          },
          metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
        },
        { awaitHandlers: true },
      );
    } else {
      failureReport = buildFailureReport({
        finalRun: finalTestResults,
        iterations,
        maxIterations,
        rootCauseAnalysis: lastRootCause,
      });
      reportDoc.status = 'failed';
      reportDoc.failureReport = failureReport;

      await eventBus.publish(
        {
          type: 'TESTING_FAILED',
          payload: {
            workflowId: workflow.workflowId,
            chunkId: chunk._id.toString(),
            iterationsUsed: Math.max(iterationsUsed, 1),
            maxIterations,
            failedCount: finalTestResults.failedCount,
            rootCauseSummary: failureReport.rootCauseAnalysis.slice(0, 500),
          },
          metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
        },
        { awaitHandlers: true },
      );
    }

    reportDoc.iterationsUsed = iterationsUsed;
    reportDoc.iterations = iterations;
    reportDoc.coverage = coverage;
    reportDoc.finalTestResults = finalTestResults;
    reportDoc.sourceFilesSnapshot = workingSources;
    reportDoc.updatedBy = String(user._id);
    await reportDoc.save();

    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/test`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        reportId: reportDoc._id.toString(),
        status: reportDoc.status,
        iterationsUsed,
        maxIterations,
        correlationHint: randomUUID(),
      },
    });

    return { report: mapReport(reportDoc) };
  }

  async getReport(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
  ): Promise<ChunkTestResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const chunk = await this.loadOwnedChunk(user, workflow, chunkId);

    const report = await getChunkTestReportModel()
      .findOne({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
        chunkId: chunk._id.toString(),
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!report) {
      throw new AppError(
        'TestReportNotFound',
        'No test report found for this chunk.',
        404,
        'Run POST /api/v1/workflows/:id/chunks/:chunkId/test before fetching the report.',
      );
    }

    return { report: mapReport(report) };
  }

  private async generateTests(input: {
    acceptanceCriteria: string[];
    sourceFiles: Record<string, string>;
    framework: TestFramework;
    namingPattern: string;
    chunkName: string;
    chunkDescription: string;
  }): Promise<GeneratedTest[]> {
    const completion = await this.llm.chat(
      [
        { role: 'system', content: TEST_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildTestGenerationPrompt(input),
        },
      ],
      { temperature: 0.2, maxTokens: 2048, cache: false },
    );

    const draft = parseGeneratedTestsLlmOutput(completion.content);
    const tests = normalizeGeneratedTests(draft);

    const kinds = new Set(tests.map((test) => test.kind));
    if (!kinds.has('unit') || !kinds.has('integration') || !kinds.has('edge')) {
      // Soft preference — fixtures always include all three; do not fail if LLM omits one.
      logger.info('Generated tests missing one or more kinds (unit/integration/edge)', {
        actor: 'system',
        resource: 'test-fix',
        operation: 'generateTests',
      });
    }

    return tests;
  }

  private async analyzeAndApplyFix(input: {
    failingTests: TestRunResult['results'];
    sourceFiles: Record<string, string>;
    iteration: number;
    maxIterations: number;
    generatedTests: GeneratedTest[];
  }): Promise<{
    appliedFixes: AppliedFix[];
    identifiedIssues: string[];
    rootCauseAnalysis?: string;
    nextSources: Record<string, string>;
  }> {
    const completion = await this.llm.chat(
      [
        { role: 'system', content: TEST_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildBugFixPrompt(input),
        },
      ],
      { temperature: 0.2, maxTokens: 2048, cache: false },
    );

    const draft = parseBugFixLlmOutput(completion.content);
    const nextSources = { ...input.sourceFiles };
    const appliedFixes: AppliedFix[] = [];

    for (const fix of draft.fixes) {
      nextSources[fix.filePath] = fix.replacementContent;
      appliedFixes.push({
        filePath: fix.filePath,
        summary: fix.summary,
        beforeSnippet: fix.beforeSnippet,
        afterSnippet: fix.afterSnippet,
      });
    }

    return {
      appliedFixes,
      identifiedIssues: draft.identifiedIssues,
      rootCauseAnalysis: draft.rootCauseAnalysis,
      nextSources,
    };
  }

  private defaultSourceFilesFromChunk(
    chunk: ImplementationChunkRecord,
  ): Record<string, string> {
    const files: Record<string, string> = {};
    for (const path of chunk.scope.files) {
      // Placeholder content when callers omit sourceFiles — mark as needing review.
      files[path] = `// AutoDev placeholder for ${path}\n// __BUG__: source not provided to test engine\n`;
    }
    if (Object.keys(files).length === 0) {
      files['src/placeholder.ts'] =
        '// AutoDev placeholder\n// __BUG__: no scope files on chunk\nexport {};\n';
    }
    return files;
  }

  private async loadContext(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
  ): Promise<{
    workflow: WorkflowRecord;
    chunk: ImplementationChunkRecord;
    acceptanceCriteria: string[];
    framework: TestFramework;
    namingPattern: string;
  }> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const chunk = await this.loadOwnedChunk(user, workflow, chunkId);

    const prd = await getPrdModel().findById(chunk.prdId).exec();
    let acceptanceCriteria: string[] = [];
    if (prd?.sections?.acceptanceCriteria?.length) {
      acceptanceCriteria = [...prd.sections.acceptanceCriteria];
    } else {
      const intent = await getTicketIntentModel()
        .findOne({ userId: String(user._id), ticketKey: workflow.ticketKey })
        .sort({ createdAt: -1 })
        .exec();
      acceptanceCriteria = intent?.acceptanceCriteria ?? [
        `Chunk "${chunk.name}" behaves as described: ${chunk.description}`,
      ];
    }

    const codebaseRecord =
      prd?.owner && prd?.repo
        ? await getCodebaseContextModel()
            .findOne({ userId: String(user._id), owner: prd.owner, repo: prd.repo })
            .exec()
        : null;

    const codebase = codebaseRecord?.context;
    const framework = detectTestFrameworkFromContext(codebase);
    const namingPattern = resolveTestFileNamingPattern(codebase?.namingConventions ?? []);

    return { workflow, chunk, acceptanceCriteria, framework, namingPattern };
  }

  private async loadOwnedWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<WorkflowRecord> {
    const record = await getWorkflowModel().findById(workflowDocumentId).exec();
    if (!record || record.userId !== String(user._id)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Use a valid workflow id for the signed-in user.',
      );
    }
    return record;
  }

  private async loadOwnedChunk(
    user: UserDocument,
    workflow: WorkflowRecord,
    chunkId: string,
  ): Promise<ImplementationChunkRecord> {
    const record = await getImplementationChunkModel().findById(chunkId).exec();
    if (
      !record ||
      record.userId !== String(user._id) ||
      record.workflowDocumentId !== workflow._id.toString()
    ) {
      throw new AppError(
        'ChunkNotFound',
        'Implementation chunk was not found for this workflow.',
        404,
        'Use a valid chunkId belonging to the workflow.',
      );
    }
    return record;
  }

  private buildMetadata(user: UserDocument, ticketKey: string, workflowId: string) {
    return {
      eventId: randomUUID(),
      correlationId: `ticket-${ticketKey}:${workflowId}`,
      actor: String(user._id),
      userId: String(user._id),
      timestamp: new Date().toISOString(),
    };
  }
}

export const testFixService = new TestFixService();
