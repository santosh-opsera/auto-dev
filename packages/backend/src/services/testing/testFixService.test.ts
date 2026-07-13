import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleApprovedPrd,
  sampleBuggySourceFiles,
  sampleGeneratedTestsLlmJson,
  samplePartialBugFixLlmJson,
  samplePrdSections,
  sampleSuccessfulBugFixLlmJson,
  type LlmChatMessage,
  type LlmCompletionResponse,
  type LlmEmbeddingResponse,
  type LlmRequestOptions,
} from '@autodev/shared-types';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { getChunkTestReportModel } from '../../models/chunkTestReportModel.js';
import { getImplementationChunkModel } from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getUserModel, type UserRecord } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '../events/eventBus.js';
import type { LlmAdapter } from '../llm/llmTypes.js';
import { TestFixService } from './testFixService.js';
import { VitestRunner } from './vitestRunner.js';

class ScriptedLlmAdapter implements LlmAdapter {
  private index = 0;

  constructor(private readonly responses: string[]) {}

  async complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return this.next(prompt, options);
  }

  async chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return this.next(messages.map((message) => message.content).join('\n'), options);
  }

  async embed(_text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse> {
    return {
      embedding: [0.1, 0.2],
      provider: 'local',
      model: options?.model ?? 'local-embed',
      usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
      cached: false,
    };
  }

  private next(prompt: string, options?: LlmRequestOptions): LlmCompletionResponse {
    const content = this.responses[Math.min(this.index, this.responses.length - 1)]!;
    this.index += 1;
    return {
      content,
      provider: 'local',
      model: options?.model ?? 'local-mock',
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(content.length / 4),
        totalTokens: Math.ceil((prompt.length + content.length) / 4),
      },
      cached: false,
    };
  }
}

describe('TestFixService integration', () => {
  let user: UserRecord;

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getChunkTestReportModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getChunkTestReportModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    user = loaded!;
  });

  async function seedChunk() {
    const workflow = await getWorkflowModel().create({
      userId: String(user._id),
      workflowId: 'wf-test-fix-001',
      ticketKey: 'OPL-1234',
      state: 'TESTING',
      history: [],
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    const prd = await getPrdModel().create({
      userId: String(user._id),
      ticketKey: 'OPL-1234',
      ticketIntentId: 'intent-1',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    const chunk = await getImplementationChunkModel().create({
      userId: String(user._id),
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Fix add helper',
      description: 'Correct add implementation',
      scope: {
        files: ['src/math/add.ts'],
        modules: ['math'],
      },
      dependencies: [],
      estimatedComplexity: 'low',
      status: 'IN_PROGRESS',
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    return { workflowId: workflow._id.toString(), chunkId: chunk._id.toString() };
  }

  it('runs generate → fail → fix → pass loop and emits testing events', async () => {
    const { workflowId, chunkId } = await seedChunk();
    const llm = new ScriptedLlmAdapter([
      sampleGeneratedTestsLlmJson,
      samplePartialBugFixLlmJson,
      sampleSuccessfulBugFixLlmJson,
    ]);
    const service = new TestFixService(llm, new VitestRunner());

    const { report } = await service.runForChunk(user, workflowId, chunkId, {
      maxIterations: 5,
      sourceFiles: sampleBuggySourceFiles,
    });

    expect(report.status).toBe('passed');
    expect(report.iterationsUsed).toBeGreaterThanOrEqual(1);
    expect(report.generatedTests.some((test) => test.kind === 'unit')).toBe(true);
    expect(report.generatedTests.some((test) => test.kind === 'integration')).toBe(true);
    expect(report.generatedTests.some((test) => test.kind === 'edge')).toBe(true);
    expect(report.coverage.overallPercent).toBeGreaterThan(0);
    expect(report.iterations.every((item) => item.loggedAt)).toBe(true);

    const types = eventBus.getHistory().map((event) => event.type);
    expect(types).toContain('TESTING_STARTED');
    expect(types).toContain('TESTING_ITERATION');
    expect(types).toContain('TESTING_PASSED');

    const fetched = await service.getReport(user, workflowId, chunkId);
    expect(fetched.report.id).toBe(report.id);
  });

  it('never exceeds maxIterations and returns a failure report when exhausted', async () => {
    const { workflowId, chunkId } = await seedChunk();
    const llm = new ScriptedLlmAdapter([
      sampleGeneratedTestsLlmJson,
      samplePartialBugFixLlmJson,
      samplePartialBugFixLlmJson,
      samplePartialBugFixLlmJson,
    ]);
    const service = new TestFixService(llm, new VitestRunner());

    const { report } = await service.runForChunk(user, workflowId, chunkId, {
      maxIterations: 2,
      sourceFiles: sampleBuggySourceFiles,
    });

    expect(report.status).toBe('failed');
    expect(report.iterationsUsed).toBeLessThanOrEqual(2);
    expect(report.failureReport).toBeDefined();
    expect(report.failureReport?.maxIterations).toBe(2);
    expect(report.failureReport?.failingTests.length).toBeGreaterThan(0);
    expect(eventBus.getHistory().some((event) => event.type === 'TESTING_FAILED')).toBe(true);
  });

  it('clamps absurd maxIterations at the service hard ceiling', async () => {
    const { workflowId, chunkId } = await seedChunk();
    const llm = new ScriptedLlmAdapter([sampleGeneratedTestsLlmJson]);
    const service = new TestFixService(llm, new VitestRunner());

    const { report } = await service.runForChunk(user, workflowId, chunkId, {
      maxIterations: 999,
      sourceFiles: {
        'src/math/add.ts': `export function add(a: number, b: number): number {
  return a + b;
}
`,
      },
    });

    expect(report.maxIterations).toBe(20);
    expect(report.status).toBe('passed');
  });
});
