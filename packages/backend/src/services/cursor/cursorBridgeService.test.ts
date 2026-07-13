import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleApprovedPrd,
  sampleAutoDevLikeContext,
  sampleCursorConventions,
  sampleImplementationChunks,
  samplePrdSections,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { ensureIndexes } from '../../database/indexes.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getConventionSettingsModel } from '../../models/conventionSettingsModel.js';
import { getImplementationChunkModel } from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getUserModel } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { AppError } from '../../utils/errors.js';
import { CursorBridgeService } from './cursorBridgeService.js';
import { InMemoryMockCursorClient, UnavailableCursorClient } from './cursorClient.js';

describe('CursorBridgeService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getTicketIntentModel(),
      getCodebaseContextModel(),
      getConventionSettingsModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
    await getConventionSettingsModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  async function seedBridgeGraph(userId: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey: sampleTicketIntent.ticketKey,
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
      treeFingerprint: 'fp-cursor-001',
      context: { ...sampleAutoDevLikeContext },
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: userId,
      updatedBy: userId,
    });

    await getConventionSettingsModel().create({
      userId,
      version: 1,
      isActive: true,
      ...sampleCursorConventions,
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-cursor-001',
      ticketKey: sampleTicketIntent.ticketKey,
      state: 'APPROVED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: sampleTicketIntent.ticketKey,
      ticketIntentId: intent._id.toString(),
      workflowId: workflow.workflowId,
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
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

    const sample = sampleImplementationChunks[0]!;
    const chunk = await getImplementationChunkModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: sample.order,
      name: sample.name,
      description: sample.description,
      scope: sample.scope,
      dependencies: [],
      estimatedComplexity: sample.estimatedComplexity,
      status: 'PENDING',
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    return { workflow, prd, chunk, intent };
  }

  it('packages context, delivers via mock Cursor, validates results, and audits', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, chunk } = await seedBridgeGraph(String(user!._id));
    const mock = new InMemoryMockCursorClient();
    const service = new CursorBridgeService(mock);

    const packaged = await service.getContext(user!, workflow._id.toString(), chunk._id.toString());
    expect(packaged.context.guidance.filesToModify).toEqual(chunk.scope.files);
    expect(packaged.context.conventions.branchNamingPattern).toBe(
      sampleCursorConventions.branchNamingPattern,
    );

    const executed = await service.execute(user!, workflow._id.toString(), chunk._id.toString());
    expect(executed.delivery.status).toBe('delivered');
    expect(executed.result).toBeDefined();
    expect(executed.validation?.scope.valid).toBe(true);
    expect(executed.validation?.conventions.valid).toBe(true);
    expect(mock.delivered).toHaveLength(1);

    const refreshed = await getImplementationChunkModel().findById(chunk._id).exec();
    expect(refreshed?.status).toBe('IN_PROGRESS');

    const audits = await getAuditLogModel().find({}).exec();
    const resources = audits.map((record) => record.resource);
    expect(resources.some((resource) => resource.includes('/cursor/deliver'))).toBe(true);
    expect(resources.some((resource) => resource.includes('/cursor/results'))).toBe(true);
  });

  it('accepts inbound webhook-style results and flags out-of-scope files', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, chunk } = await seedBridgeGraph(String(user!._id));
    const service = new CursorBridgeService(new InMemoryMockCursorClient());

    const response = await service.submitResults(user!, workflow._id.toString(), chunk._id.toString(), {
      chunkId: chunk._id.toString(),
      workflowId: workflow.workflowId,
      branchName: 'feature/OPL-1234',
      commitMessage: 'OPL-1234: Implement chunk',
      fileChanges: [
        { path: chunk.scope.files[0]!, action: 'modified', content: '// ok\n' },
        { path: 'unexpected/path.ts', action: 'created', content: '// bad\n' },
      ],
      newFiles: ['unexpected/path.ts'],
      deletedFiles: [],
      summary: 'partial',
    });

    expect(response.validation.scope.valid).toBe(false);
    expect(response.validation.scope.unexpectedFiles).toContain('unexpected/path.ts');
    expect(response.validation.conventions.valid).toBe(true);
  });

  it('returns clear error when Cursor is unavailable', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, chunk } = await seedBridgeGraph(String(user!._id));
    const service = new CursorBridgeService(new UnavailableCursorClient());

    await expect(
      service.execute(user!, workflow._id.toString(), chunk._id.toString()),
    ).rejects.toMatchObject({
      error: 'CursorUnavailable',
      statusCode: 503,
    } satisfies Partial<AppError>);
  });

  it('supports dryRun packaging without requiring Cursor availability', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, chunk } = await seedBridgeGraph(String(user!._id));
    const service = new CursorBridgeService(new UnavailableCursorClient());

    const response = await service.execute(user!, workflow._id.toString(), chunk._id.toString(), {
      dryRun: true,
    });

    expect(response.delivery.status).toBe('dry_run');
    expect(response.result).toBeUndefined();
  });
});
