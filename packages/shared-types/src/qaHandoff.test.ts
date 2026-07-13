import { describe, expect, it } from 'vitest';
import {
  buildVerificationChecklist,
  QA_HANDOFF_STATUSES,
  qaHandoffApproveRequestSchema,
  qaHandoffGenerateRequestSchema,
  qaHandoffRequestChangesRequestSchema,
  qaHandoffResponseSchema,
} from './qaHandoff.js';
import {
  sampleQaHandoffApproved,
  sampleQaHandoffChangesRequested,
  sampleQaHandoffGenerateRequest,
  sampleQaHandoffReady,
  sampleQaHandoffRequestChanges,
  sampleVerificationChecklist,
  sampleWorkflowHandoffInputs,
} from './fixtures/qaHandoff.js';

describe('qaHandoff schemas', () => {
  it('exposes handoff statuses', () => {
    expect(QA_HANDOFF_STATUSES).toEqual(['READY', 'APPROVED', 'CHANGES_REQUESTED']);
  });

  it('builds checkable checklist items from acceptance criteria', () => {
    const checklist = buildVerificationChecklist([
      'User can sign in with GitHub OAuth',
      'Session persists for 8 hours',
    ]);

    expect(checklist).toEqual([
      {
        id: 'ac-1',
        acceptanceCriterion: 'User can sign in with GitHub OAuth',
        status: 'unchecked',
      },
      {
        id: 'ac-2',
        acceptanceCriterion: 'Session persists for 8 hours',
        status: 'unchecked',
      },
    ]);
    expect(sampleVerificationChecklist.every((item) => item.status === 'unchecked')).toBe(true);
  });

  it('validates generate, approve, and request-changes payloads', () => {
    expect(qaHandoffGenerateRequestSchema.safeParse(sampleQaHandoffGenerateRequest).success).toBe(
      true,
    );
    expect(qaHandoffApproveRequestSchema.safeParse({ notes: 'Looks good' }).success).toBe(true);
    expect(
      qaHandoffRequestChangesRequestSchema.safeParse(sampleQaHandoffRequestChanges).success,
    ).toBe(true);
    expect(qaHandoffRequestChangesRequestSchema.safeParse({ feedbackItems: [] }).success).toBe(
      false,
    );
  });

  it('validates handoff response fixtures across lifecycle states', () => {
    expect(qaHandoffResponseSchema.safeParse(sampleQaHandoffReady).success).toBe(true);
    expect(qaHandoffResponseSchema.safeParse(sampleQaHandoffApproved).success).toBe(true);
    expect(qaHandoffResponseSchema.safeParse(sampleQaHandoffChangesRequested).success).toBe(true);
    expect(sampleQaHandoffReady.deploymentUrl).toBeTruthy();
    expect(sampleQaHandoffReady.jiraTicket.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(sampleQaHandoffReady.coverageReport.coveragePercent).toBeGreaterThan(0);
    expect(sampleQaHandoffReady.changeSummary.filesChanged.length).toBeGreaterThan(0);
    expect(sampleWorkflowHandoffInputs.ticketKey).toBe('OPL-1234');
  });
});
