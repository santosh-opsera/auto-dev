import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sampleApprovedPrd,
  sampleChunkLlmJsonResponse,
  samplePrdSections,
} from '@autodev/shared-types';
import { ensureIndexes } from '../../database/indexes.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getImplementationChunkModel } from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getUserModel } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { AppError } from '../../utils/errors.js';
import { eventBus } from '../events/eventBus.js';
import { ChunkManager } from './chunkManager.js';

const chatMock = vi.fn();

vi.mock('../llm/llmAdapter.js', () => ({
  llmAdapter: {
    chat: (...args: unknown[]) => chatMock(...args),
    complete: vi.fn(),
    embed: vi.fn(),
  },
}));

describe('ChunkManager', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    chatMock.mockReset();
    chatMock.mockResolvedValue({
      content: sampleChunkLlmJsonResponse,
      provider: 'local',
      model: 'local-mock',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      cached: false,
    });
    eventBus.clearHistory();

    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  async function seedWorkflowAndApprovedPrd(userId: string) {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-chunk-001',
      ticketKey: sampleApprovedPrd.ticketKey,
      state: 'APPROVED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: sampleApprovedPrd.ticketKey,
      ticketIntentId: sampleApprovedPrd.ticketIntentId,
      workflowId: workflow.workflowId,
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      approvedBy: 'Alex Developer',
      approvedAt: new Date('2026-07-13T12:00:00.000Z'),
      createdBy: userId,
      updatedBy: userId,
    });

    return { workflow, prd };
  }

  it('decomposes an approved PRD into ordered chunks and emits CHUNK_CREATED', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, prd } = await seedWorkflowAndApprovedPrd(String(user!._id));
    const service = new ChunkManager({ chat: chatMock } as never, [0, 0]);

    const result = await service.decompose(user!, workflow._id.toString(), {
      prdId: prd._id.toString(),
    });

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks.map((chunk) => chunk.order)).toEqual([0, 1, 2]);
    expect(result.chunks[0]?.dependencies).toEqual([]);
    expect(result.chunks[1]?.dependencies).toEqual([result.chunks[0]!.id]);
    expect(result.chunks[2]?.dependencies).toEqual([result.chunks[1]!.id]);
    expect(result.chunks.every((chunk) => chunk.status === 'PENDING')).toBe(true);
    expect(result.chunks.every((chunk) => chunk.prdId === prd._id.toString())).toBe(true);
    expect(chatMock).toHaveBeenCalled();

    const createdEvents = eventBus.getHistory().filter((event) => event.type === 'CHUNK_CREATED');
    expect(createdEvents).toHaveLength(3);
    expect(createdEvents[0]?.type === 'CHUNK_CREATED' && createdEvents[0].payload.order).toBe(0);

    const listed = await service.listForWorkflow(user!, workflow._id.toString());
    expect(listed.chunks).toHaveLength(3);
  });

  it('rejects decomposition for non-approved PRDs', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, prd } = await seedWorkflowAndApprovedPrd(String(user!._id));
    prd.status = 'draft';
    await prd.save();

    const service = new ChunkManager({ chat: chatMock } as never, [0, 0]);
    await expect(
      service.decompose(user!, workflow._id.toString(), { prdId: prd._id.toString() }),
    ).rejects.toMatchObject({ error: 'PrdNotApproved' } satisfies Partial<AppError>);
  });

  it('enforces dependency completion before IN_PROGRESS and allows status transitions', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, prd } = await seedWorkflowAndApprovedPrd(String(user!._id));
    const service = new ChunkManager({ chat: chatMock } as never, [0, 0]);

    const { chunks } = await service.decompose(user!, workflow._id.toString(), {
      prdId: prd._id.toString(),
    });

    await expect(
      service.updateStatus(user!, workflow._id.toString(), chunks[1]!.id, {
        status: 'IN_PROGRESS',
      }),
    ).rejects.toMatchObject({ error: 'ChunkDependenciesIncomplete' });

    const first = await service.updateStatus(user!, workflow._id.toString(), chunks[0]!.id, {
      status: 'IN_PROGRESS',
    });
    expect(first.status).toBe('IN_PROGRESS');

    const completed = await service.updateStatus(user!, workflow._id.toString(), chunks[0]!.id, {
      status: 'COMPLETED',
    });
    expect(completed.status).toBe('COMPLETED');

    const second = await service.updateStatus(user!, workflow._id.toString(), chunks[1]!.id, {
      status: 'IN_PROGRESS',
    });
    expect(second.status).toBe('IN_PROGRESS');

    const paused = await service.updateStatus(user!, workflow._id.toString(), chunks[1]!.id, {
      status: 'PAUSED',
    });
    expect(paused.status).toBe('PAUSED');

    const progressEvents = eventBus.getHistory().filter((event) => event.type === 'CHUNK_PROGRESS');
    expect(progressEvents.length).toBeGreaterThanOrEqual(3);

    await expect(
      service.updateStatus(user!, workflow._id.toString(), chunks[0]!.id, {
        status: 'IN_PROGRESS',
      }),
    ).rejects.toMatchObject({ error: 'InvalidChunkStatusTransition' });
  });
});
