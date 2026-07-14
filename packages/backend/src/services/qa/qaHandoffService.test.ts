import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  sampleQaHandoffGenerateRequest,
  sampleQaHandoffRequestChanges,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getQaHandoffModel } from '../../models/qaHandoffModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getUserModel } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '@autodev/infrastructure';
import {
  assembleCoverageFromReports,
  generateVerificationChecklist,
  QaHandoffService,
} from './qaHandoffService.js';

describe('QaHandoffService', () => {
  const service = new QaHandoffService();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getTicketIntentModel(),
      getQaHandoffModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getQaHandoffModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
  });

  async function getUser() {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    if (!user) {
      throw new Error('seed user missing');
    }
    return user;
  }

  async function seedWorkflow() {
    const user = await getUser();
    const workflow = await getWorkflowModel().create({
      userId: user._id.toString(),
      workflowId: 'workflow-001',
      ticketKey: sampleTicketIntent.ticketKey,
      state: 'PR_CREATED',
      history: [],
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
      dataClassification: 'internal',
    });

    await getTicketIntentModel().create({
      userId: user._id.toString(),
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
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
      dataClassification: 'internal',
    });

    return { user, workflow };
  }

  it('builds verification checklist from acceptance criteria with checkable status', () => {
    const checklist = generateVerificationChecklist([
      'User can sign in with GitHub OAuth',
      'Session persists for 8 hours',
    ]);

    expect(checklist).toHaveLength(2);
    expect(checklist[0]).toMatchObject({
      id: 'ac-1',
      status: 'unchecked',
      acceptanceCriterion: 'User can sign in with GitHub OAuth',
    });
    expect(checklist.every((item) => item.status === 'unchecked')).toBe(true);
  });

  it('assembles coverage report from mock test results', () => {
    const coverage = assembleCoverageFromReports([
      {
        coverage: {
          overallPercent: 90,
          lines: 90,
          branches: 80,
          functions: 95,
          statements: 88,
        },
        sourceFilesSnapshot: { 'src/auth.ts': 'export {}' },
      },
      {
        coverage: {
          overallPercent: 80,
          lines: 80,
          branches: 70,
          functions: 85,
          statements: 78,
        },
      },
    ]);

    expect(coverage.coveragePercent).toBe(85);
    expect(coverage.lines).toBe(85);
    expect(coverage.uncoveredLines.some((e) => e.filePath === 'src/auth.ts')).toBe(true);
  });

  it('assembles a full handoff package from workflow data and persists it', async () => {
    const { user, workflow } = await seedWorkflow();

    const handoff = await service.generate(user, workflow._id.toString(), sampleQaHandoffGenerateRequest);

    expect(handoff.status).toBe('READY');
    expect(handoff.workflowId).toBe('workflow-001');
    expect(handoff.jiraTicket.ticketKey).toBe('OPL-1234');
    expect(handoff.jiraTicket.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(handoff.verificationChecklist).toHaveLength(
      handoff.jiraTicket.acceptanceCriteria.length,
    );
    expect(handoff.changeSummary.filesChanged.length).toBeGreaterThan(0);
    expect(handoff.coverageReport.coveragePercent).toBeGreaterThan(0);
    expect(handoff.deploymentUrl).toBeTruthy();

    const stored = await getQaHandoffModel().findById(handoff.id);
    expect(stored?.workflowDocumentId).toBe(workflow._id.toString());

    const events = eventBus.getHistory().map((e) => e.type);
    expect(events).toContain('QA_HANDOFF_READY');
  });

  it('routes change requests to developers via EventBus', async () => {
    const { user, workflow } = await seedWorkflow();
    await service.generate(user, workflow._id.toString(), sampleQaHandoffGenerateRequest);

    const updated = await service.requestChanges(
      user,
      workflow._id.toString(),
      sampleQaHandoffRequestChanges,
    );

    expect(updated.status).toBe('CHANGES_REQUESTED');
    expect(updated.feedbackItems).toHaveLength(2);

    const changeEvent = eventBus.getHistory().find((e) => e.type === 'QA_CHANGES_REQUESTED');
    expect(changeEvent).toBeDefined();
    if (changeEvent?.type === 'QA_CHANGES_REQUESTED') {
      expect(changeEvent.payload.feedbackCount).toBe(2);
      expect(changeEvent.payload.ticketKey).toBe('OPL-1234');
      expect(changeEvent.payload.feedbackItems[0]?.description).toContain('Session expiry');
    }
  });

  it('approves handoff and emits QA_HANDOFF_APPROVED', async () => {
    const { user, workflow } = await seedWorkflow();
    await service.generate(user, workflow._id.toString(), sampleQaHandoffGenerateRequest);

    const approved = await service.approve(user, workflow._id.toString(), {
      notes: 'Verified against AC',
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.verificationChecklist.every((item) => item.status === 'checked')).toBe(true);
    expect(eventBus.getHistory().map((e) => e.type)).toContain('QA_HANDOFF_APPROVED');
  });
});
