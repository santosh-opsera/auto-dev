import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sampleCriticalGaps,
  sampleExpectedNamingDivergence,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { getApprovalRequestModel } from '../../models/approvalRequestModel.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getDivergenceRecordModel } from '../../models/divergenceRecordModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getUserModel } from '../../models/userModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '../events/eventBus.js';
import { approvalGateService } from './approvalGateService.js';

describe('ApprovalGateService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getTicketIntentModel(),
      getDivergenceRecordModel(),
      getApprovalRequestModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getDivergenceRecordModel().deleteMany({});
    await getApprovalRequestModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    vi.useRealTimers();
  });

  async function seedGapAndDivergence(userId: string, ticketKey: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey,
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach: sampleTicketIntent.proposedApproach,
      acceptanceCriteria: [],
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: sampleCriticalGaps,
      canProceedToAnalysis: false,
      createdBy: userId,
      updatedBy: userId,
    });

    const divergence = await getDivergenceRecordModel().create({
      userId,
      ticketKey,
      ticketIntentId: intent._id.toString(),
      codebaseContextId: 'context-001',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      workflowId: 'workflow-seed',
      divergences: [sampleExpectedNamingDivergence],
      aligned: false,
      summary: 'Naming conflict detected',
      createdBy: userId,
      updatedBy: userId,
    });

    await getTicketIntentModel()
      .updateOne(
        { _id: intent._id },
        { $set: { latestDivergenceRecordId: divergence._id.toString() } },
      )
      .exec();

    return { intent, divergence };
  }

  it('aggregates gaps and divergences into a single approval request', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedGapAndDivergence(String(user!._id), 'OPL-5001');

    const request = await approvalGateService.createApprovalRequest(
      user!,
      'OPL-5001',
      'workflow-5001',
    );

    expect(request.items).toHaveLength(2);
    expect(request.items.map((item) => item.type).sort()).toEqual(['divergence', 'gap']);
    expect(request.status).toBe('open');
    expect(eventBus.getHistory().some((event) => event.type === 'APPROVAL_REQUESTED')).toBe(true);
  });

  it('records decisions via audit and blocks expired item resolution', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedGapAndDivergence(String(user!._id), 'OPL-5002');

    const created = await approvalGateService.createApprovalRequest(
      user!,
      'OPL-5002',
      'workflow-5002',
    );

    const gapItem = created.items.find((item) => item.type === 'gap')!;
    const resolved = await approvalGateService.resolveItem(user!, created.id, gapItem.itemId, {
      action: 'approve',
      rationale: 'Accept suggested AC',
    });

    expect(resolved.items.find((item) => item.itemId === gapItem.itemId)?.status).toBe('approved');

    const audits = await getAuditLogModel()
      .find({ resource: `approval_requests/${created.id}/items/${gapItem.itemId}` })
      .exec();
    expect(audits.length).toBeGreaterThan(0);

    const divergenceItem = resolved.items.find((item) => item.type === 'divergence')!;
    await approvalGateService.resolveItem(user!, created.id, divergenceItem.itemId, {
      action: 'modify',
      modifiedValue: 'Use camelCase naming',
      rationale: 'Align with codebase',
    });

    const status = await approvalGateService.getStatus(user!, created.id);
    expect(status.canProceed).toBe(true);
    expect(status.pendingCount).toBe(0);
  });

  it('expires unresolved items after 72 hours and emits APPROVAL_EXPIRED', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T08:00:00.000Z'));

    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedGapAndDivergence(String(user!._id), 'OPL-5003');

    const created = await approvalGateService.createApprovalRequest(
      user!,
      'OPL-5003',
      'workflow-5003',
    );

    vi.setSystemTime(new Date('2026-07-14T09:00:00.000Z'));
    const status = await approvalGateService.getStatus(user!, created.id);

    expect(status.canProceed).toBe(false);
    expect(status.expiredCount).toBe(2);
    expect(status.status).toBe('blocked');
    expect(eventBus.getHistory().some((event) => event.type === 'APPROVAL_EXPIRED')).toBe(true);

    const firstItem = created.items[0]!;
    await expect(
      approvalGateService.resolveItem(user!, created.id, firstItem.itemId, {
        action: 'approve',
      }),
    ).rejects.toMatchObject({ error: 'ApprovalItemExpired' });
  });

  it('emits reminder events at 24h and 48h remaining', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T08:00:00.000Z'));

    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedGapAndDivergence(String(user!._id), 'OPL-5004');

    const created = await approvalGateService.createApprovalRequest(
      user!,
      'OPL-5004',
      'workflow-5004',
    );

    vi.setSystemTime(new Date('2026-07-12T08:00:00.000Z')); // 48h remaining
    await approvalGateService.getRequest(user!, created.id);

    vi.setSystemTime(new Date('2026-07-13T08:00:00.000Z')); // 24h remaining
    await approvalGateService.getRequest(user!, created.id);

    const reminders = eventBus.getHistory().filter((event) => event.type === 'APPROVAL_REMINDER');
    expect(reminders.map((event) => event.payload.reminder).sort()).toEqual(['24h', '48h']);
  });
});
