import type {
  ChangeSummary,
  HandoffCoverageReport,
  HandoffJiraTicket,
  QaFeedbackItem,
  QaHandoffGenerateRequest,
  QaHandoffRequestChangesRequest,
  QaHandoffResponse,
  VerificationChecklistItem,
} from '../qaHandoff.js';
import { buildVerificationChecklist } from '../qaHandoff.js';
import { DEFAULT_LOCAL_DEPLOYMENT_BASE_URL } from '../deployments.js';

export const sampleHandoffJiraTicket: HandoffJiraTicket = {
  ticketKey: 'OPL-1234',
  summary: 'Add OAuth support',
  acceptanceCriteria: [
    'User can sign in with GitHub OAuth',
    'Session persists for 8 hours',
    'Refresh tokens rotate on use',
  ],
  url: 'https://jira.example.com/browse/OPL-1234',
};

export const sampleChangeSummary: ChangeSummary = {
  filesChanged: [
    'packages/backend/src/auth/oauth.ts',
    'packages/backend/src/auth/session.ts',
    'packages/frontend/src/pages/Login.tsx',
  ],
  linesAdded: 248,
  linesRemoved: 37,
  affectedModules: ['auth', 'frontend'],
};

export const sampleHandoffCoverageReport: HandoffCoverageReport = {
  coveragePercent: 87.5,
  lines: 88,
  branches: 82,
  functions: 91,
  statements: 87,
  uncoveredLines: [
    {
      filePath: 'packages/backend/src/auth/session.ts',
      lines: [142, 143, 188],
    },
    {
      filePath: 'packages/frontend/src/pages/Login.tsx',
      lines: [56],
    },
  ],
};

export const sampleVerificationChecklist: VerificationChecklistItem[] =
  buildVerificationChecklist(sampleHandoffJiraTicket.acceptanceCriteria);

export const sampleQaFeedbackItems: QaFeedbackItem[] = [
  {
    id: 'fb-1',
    description: 'Session expiry edge case fails when clock skew exceeds 2 minutes',
    checklistItemId: 'ac-2',
  },
  {
    id: 'fb-2',
    description: 'Add regression test for refresh-token rotation under concurrent requests',
    checklistItemId: 'ac-3',
  },
];

export const sampleQaHandoffGenerateRequest: QaHandoffGenerateRequest = {
  changeSummary: sampleChangeSummary,
  coverageReport: sampleHandoffCoverageReport,
  deploymentUrl: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  jiraTicket: sampleHandoffJiraTicket,
};

export const sampleQaHandoffRequestChanges: QaHandoffRequestChangesRequest = {
  feedbackItems: sampleQaFeedbackItems,
};

/** Sample workflow-linked handoff in READY state for fixture-driven tests. */
export const sampleQaHandoffReady: QaHandoffResponse = {
  id: 'handoff-001',
  workflowDocumentId: '507f1f77bcf86cd799439011',
  workflowId: 'workflow-001',
  status: 'READY',
  changeSummary: sampleChangeSummary,
  jiraTicket: sampleHandoffJiraTicket,
  coverageReport: sampleHandoffCoverageReport,
  verificationChecklist: sampleVerificationChecklist,
  deploymentUrl: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  createdAt: '2026-07-13T12:00:00.000Z',
  updatedAt: '2026-07-13T12:00:00.000Z',
};

export const sampleQaHandoffApproved: QaHandoffResponse = {
  ...sampleQaHandoffReady,
  id: 'handoff-002',
  status: 'APPROVED',
  verificationChecklist: sampleVerificationChecklist.map((item) => ({
    ...item,
    status: 'checked' as const,
  })),
  approvedAt: '2026-07-13T14:00:00.000Z',
  updatedAt: '2026-07-13T14:00:00.000Z',
};

export const sampleQaHandoffChangesRequested: QaHandoffResponse = {
  ...sampleQaHandoffReady,
  id: 'handoff-003',
  status: 'CHANGES_REQUESTED',
  feedbackItems: sampleQaFeedbackItems,
  changesRequestedAt: '2026-07-13T13:30:00.000Z',
  updatedAt: '2026-07-13T13:30:00.000Z',
};

/** Mock test-result snapshot used by integration tests for handoff assembly. */
export const sampleWorkflowHandoffInputs = {
  workflowId: 'workflow-001',
  ticketKey: 'OPL-1234',
  changeSummary: sampleChangeSummary,
  coverageReport: sampleHandoffCoverageReport,
  deploymentUrl: DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  jiraTicket: sampleHandoffJiraTicket,
};
