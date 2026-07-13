import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodePrdSections,
  sampleAutoDevLikeContext,
  samplePrdLlmJsonResponse,
  samplePrdSections,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { ensureIndexes } from '../../database/indexes.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getUserModel } from '../../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { AppError } from '../../utils/errors.js';
import { PrdGenerationService } from './prdGenerationService.js';

const chatMock = vi.fn();

vi.mock('../llm/llmAdapter.js', () => ({
  llmAdapter: {
    chat: (...args: unknown[]) => chatMock(...args),
    complete: vi.fn(),
    embed: vi.fn(),
  },
}));

describe('PrdGenerationService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getTicketIntentModel(),
      getCodebaseContextModel(),
      getPrdModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    chatMock.mockReset();
    chatMock.mockResolvedValue({
      content: samplePrdLlmJsonResponse,
      provider: 'local',
      model: 'local-mock',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      cached: false,
    });

    await getUserModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  async function seedIntentAndContext(userId: string, ticketKey: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey,
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach: sampleTicketIntent.proposedApproach,
      acceptanceCriteria: sampleTicketIntent.acceptanceCriteria,
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: [],
      canProceedToAnalysis: true,
      createdBy: userId,
      updatedBy: userId,
    });

    await getCodebaseContextModel().create({
      userId,
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
      branch: sampleAutoDevLikeContext.branch,
      treeFingerprint: 'fp-prd-001',
      context: {
        ...sampleAutoDevLikeContext,
        analyzedAt: sampleAutoDevLikeContext.analyzedAt,
      },
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: userId,
      updatedBy: userId,
    });

    return intent;
  }

  it('generates, XSS-encodes, and versions PRDs linked to TicketIntent', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const intent = await seedIntentAndContext(String(user!._id), 'OPL-7001');
    const service = new PrdGenerationService(
      { chat: chatMock } as never,
      30_000,
      [0, 0],
    );

    chatMock.mockResolvedValueOnce({
      content: JSON.stringify({
        ...samplePrdSections,
        problemStatement: 'Need <script>alert(1)</script> safe encoding',
      }),
      provider: 'local',
      model: 'local-mock',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      cached: false,
    });

    const first = await service.generate(user!, 'OPL-7001', {
      workflowId: 'wf-7001',
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
    });

    expect(first.version).toBe(1);
    expect(first.ticketIntentId).toBe(intent._id.toString());
    expect(first.sections.problemStatement).toContain('&lt;script&gt;');
    expect(first.codebaseContext.applicablePatterns).toEqual(
      expect.arrayContaining(['service-layer']),
    );
    expect(chatMock).toHaveBeenCalled();

    const second = await service.generate(user!, 'OPL-7001', {
      workflowId: 'wf-7001',
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
    });

    expect(second.version).toBe(2);
    expect(second.previousVersionId).toBe(first.id);
    expect(second.isActive).toBe(true);

    const previous = await service.getById(user!, first.id);
    expect(previous.isActive).toBe(false);

    const latest = await service.getLatestForTicket(user!, 'OPL-7001');
    expect(latest.id).toBe(second.id);

    const edited = await service.createVersion(user!, second.id, {
      sections: encodePrdSections({
        ...samplePrdSections,
        solutionOutline: 'Edited outline after review',
      }),
      status: 'in_review',
    });

    expect(edited.version).toBe(3);
    expect(edited.previousVersionId).toBe(second.id);
    expect(edited.status).toBe('in_review');
  });

  it('retries LLM failures and returns a clear retryable error', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedIntentAndContext(String(user!._id), 'OPL-7002');

    chatMock
      .mockRejectedValueOnce(new Error('provider down'))
      .mockRejectedValueOnce(new Error('provider down'));

    const service = new PrdGenerationService({ chat: chatMock } as never, 30_000, [0, 0]);

    await expect(
      service.generate(user!, 'OPL-7002', {
        owner: sampleAutoDevLikeContext.owner,
        repo: sampleAutoDevLikeContext.repo,
      }),
    ).rejects.toMatchObject({
      error: 'PrdGenerationFailed',
      suggestedAction: expect.stringContaining('Retry'),
    });

    expect(chatMock).toHaveBeenCalledTimes(2);
  });

  it('enforces the generation timeout budget', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedIntentAndContext(String(user!._id), 'OPL-7003');

    chatMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: samplePrdLlmJsonResponse,
              provider: 'local',
              model: 'local-mock',
              usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
              cached: false,
            });
          }, 50);
        }),
    );

    const service = new PrdGenerationService({ chat: chatMock } as never, 10, [0]);

    await expect(
      service.generate(user!, 'OPL-7003', {
        owner: sampleAutoDevLikeContext.owner,
        repo: sampleAutoDevLikeContext.repo,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.generate(user!, 'OPL-7003', {
        owner: sampleAutoDevLikeContext.owner,
        repo: sampleAutoDevLikeContext.repo,
      }),
    ).rejects.toMatchObject({ error: 'PrdGenerationTimeout' });
  });
});
