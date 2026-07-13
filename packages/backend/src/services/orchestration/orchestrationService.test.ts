import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDocument } from '../../models/userModel.js';
import type { WorkflowState } from '@autodev/shared-types';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getUserModel } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { AppError } from '../../utils/errors.js';
import { eventBus } from '../events/eventBus.js';
import { orchestrationService } from './orchestrationService.js';

async function advanceTo(user: UserDocument, id: string, states: WorkflowState[]) {
  for (const toState of states) {
    await orchestrationService.transition(user, id, {
      toState,
      trigger: `test.${toState.toLowerCase()}`,
    });
  }
}

describe('OrchestrationService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getUserModel(), getWorkflowModel(), getAuditLogModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  it('creates workflows in CREATED and lists with state filter', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();

    const created = await orchestrationService.createWorkflow(user!, {
      ticketKey: 'OPL-8001',
      workflowId: 'wf-8001',
    });

    expect(created.state).toBe('CREATED');
    expect(created.availableTransitions).toEqual(['TICKET_PARSED', 'CANCELLED', 'FAILED']);

    await orchestrationService.createWorkflow(user!, {
      ticketKey: 'OPL-8002',
      workflowId: 'wf-8002',
    });

    const listed = await orchestrationService.listWorkflows(user!, { state: 'CREATED' });
    expect(listed.workflows).toHaveLength(2);
  });

  it('persists transitions, emits events, and rejects invalid transitions', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const created = await orchestrationService.createWorkflow(user!, {
      ticketKey: 'OPL-8101',
      workflowId: 'wf-8101',
    });

    const next = await orchestrationService.transition(user!, created.id, {
      toState: 'TICKET_PARSED',
      trigger: 'ticket.parsed',
    });

    expect(next.state).toBe('TICKET_PARSED');
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({
      previousState: 'CREATED',
      newState: 'TICKET_PARSED',
      trigger: 'ticket.parsed',
    });

    const events = eventBus.getHistory().filter((event) => event.type === 'WORKFLOW_TRANSITIONED');
    expect(events).toHaveLength(1);

    await expect(
      orchestrationService.transition(user!, created.id, { toState: 'IMPLEMENTING' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('supports pause, resume, and cancel with progress preservation', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const created = await orchestrationService.createWorkflow(user!, {
      ticketKey: 'OPL-8201',
      workflowId: 'wf-8201',
    });

    await advanceTo(user!, created.id, [
      'TICKET_PARSED',
      'ANALYZING',
      'ANALYSIS_COMPLETE',
      'AWAITING_APPROVAL',
      'APPROVED',
      'IMPLEMENTING',
    ]);

    const paused = await orchestrationService.pause(user!, created.id, {
      percent: 40,
      phase: 'chunk-implementation',
      chunkId: 'chunk-1',
    });

    expect(paused.state).toBe('PAUSED');
    expect(paused.pausedFrom).toBe('IMPLEMENTING');
    expect(paused.progress).toEqual({
      percent: 40,
      phase: 'chunk-implementation',
      chunkId: 'chunk-1',
    });

    const resumed = await orchestrationService.resume(user!, created.id);
    expect(resumed.state).toBe('IMPLEMENTING');
    expect(resumed.pausedFrom).toBeNull();
    expect(resumed.resumedFrom).toBe('PAUSED');
    expect(resumed.progress?.percent).toBe(40);

    const cancelled = await orchestrationService.cancel(user!, created.id);
    expect(cancelled.state).toBe('CANCELLED');
    expect(cancelled.availableTransitions).toEqual([]);
  });

  it('records failure details and retries from the failed step', async () => {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const created = await orchestrationService.createWorkflow(user!, {
      ticketKey: 'OPL-8301',
      workflowId: 'wf-8301',
    });

    await advanceTo(user!, created.id, [
      'TICKET_PARSED',
      'ANALYZING',
      'ANALYSIS_COMPLETE',
      'AWAITING_APPROVAL',
      'APPROVED',
      'IMPLEMENTING',
      'TESTING',
    ]);

    const failed = await orchestrationService.fail(user!, created.id, {
      error: { message: 'tests failed', code: 'TEST_FAILED' },
    });

    expect(failed.state).toBe('FAILED');
    expect(failed.error).toEqual({
      message: 'tests failed',
      code: 'TEST_FAILED',
      failedFrom: 'TESTING',
    });
    expect(eventBus.getHistory().some((event) => event.type === 'WORKFLOW_FAILED')).toBe(true);

    const retried = await orchestrationService.retry(user!, created.id);
    expect(retried.state).toBe('TESTING');
    expect(retried.error).toBeNull();
  });
});
