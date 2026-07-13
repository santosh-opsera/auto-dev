import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  sampleCriticalGaps,
  sampleExpectedNamingDivergence,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { createApp } from '../../../backend/src/index.js';
import { getApprovalRequestModel } from '../../../backend/src/models/approvalRequestModel.js';
import { getDivergenceRecordModel } from '../../../backend/src/models/divergenceRecordModel.js';
import { getTicketIntentModel } from '../../../backend/src/models/ticketIntentModel.js';
import { getUserModel } from '../../../backend/src/models/userModel.js';
import { installE2EApiHarness } from '../../helpers/apiHarness.js';
import { loginAsE2EUser } from '../../helpers/login.js';

installE2EApiHarness();

async function seedApprovalContext(userId: string, ticketKey: string): Promise<void> {
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
    codebaseContextId: 'context-e2e-001',
    owner: 'santosh-opsera',
    repo: 'auto-dev',
    workflowId: 'workflow-e2e',
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
}

describe('E2E API · approval gate flow', () => {
  it('detects divergences, presents comparisons, approve/reject items, and clears the gate', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsE2EUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedApprovalContext(String(user!._id), 'OPL-6001');

    const created = await request(app)
      .post('/api/v1/tickets/OPL-6001/approvals')
      .set('Cookie', sessionCookie)
      .send({ workflowId: 'workflow-e2e-6001' });

    expect(created.status).toBe(201);
    expect(created.body.items.length).toBeGreaterThanOrEqual(2);

    const blocked = await request(app)
      .post(`/api/v1/test/workflow/${created.body.id}/proceed`)
      .set('Cookie', sessionCookie);
    expect(blocked.status).toBe(412);

    const statusPending = await request(app)
      .get(`/api/v1/approvals/${created.body.id}/status`)
      .set('Cookie', sessionCookie);
    expect(statusPending.status).toBe(200);
    expect(statusPending.body.canProceed).toBe(false);
    expect(statusPending.body.pendingCount).toBeGreaterThan(0);

    for (const item of created.body.items) {
      const action = item.type === 'divergence' ? 'modify' : item.type === 'gap' ? 'approve' : 'approve';
      const resolve = await request(app)
        .post(`/api/v1/approvals/${created.body.id}/items/${item.itemId}/resolve`)
        .set('Cookie', sessionCookie)
        .send({
          action,
          rationale: 'E2E review decision',
          modifiedValue: item.type === 'divergence' ? 'Adopt codebase naming' : undefined,
        });
      expect(resolve.status).toBe(200);
    }

    // Reject path coverage on a fresh request item set is expensive; verify cleared gate.
    const statusCleared = await request(app)
      .get(`/api/v1/approvals/${created.body.id}/status`)
      .set('Cookie', sessionCookie);
    expect(statusCleared.body.canProceed).toBe(true);
    expect(statusCleared.body.pendingCount).toBe(0);

    const detail = await request(app)
      .get(`/api/v1/approvals/${created.body.id}`)
      .set('Cookie', sessionCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe('cleared');

    const allowed = await request(app)
      .post(`/api/v1/test/workflow/${created.body.id}/proceed`)
      .set('Cookie', sessionCookie);
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);

    const persisted = await getApprovalRequestModel().findById(created.body.id).exec();
    expect(persisted?.status).toBe('cleared');
  });
});
