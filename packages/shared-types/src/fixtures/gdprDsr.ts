import type {
  CancelErasureResponse,
  DataExportResponse,
  ErasureExecutionSummary,
  ErasureScheduleResponse,
  UpdateUserProfileInput,
  UpdateUserProfileResponse,
  UserProfileExport,
} from '../gdprDsr.js';
import { ERASURE_GRACE_PERIOD_MS } from '../gdprDsr.js';

export const sampleUserProfileExport: UserProfileExport = {
  id: '507f1f77bcf86cd799439011',
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  role: 'user',
  connectedProviders: ['github'],
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
};

export const sampleUpdateUserProfileInput: UpdateUserProfileInput = {
  displayName: 'Alex Updated',
  email: 'alex.updated@example.com',
};

export const sampleUpdateUserProfileResponse: UpdateUserProfileResponse = {
  profile: {
    ...sampleUserProfileExport,
    displayName: sampleUpdateUserProfileInput.displayName,
    email: sampleUpdateUserProfileInput.email,
    updatedAt: '2026-07-13T15:00:00.000Z',
  },
};

export const sampleDataExportResponse: DataExportResponse = {
  exportedAt: '2026-07-13T15:00:00.000Z',
  profile: sampleUserProfileExport,
  conventionSettings: [
    {
      id: 'conv-001',
      userId: sampleUserProfileExport.id,
      version: 1,
      isActive: true,
      commitMessageFormat: '{ticketKey}: {summary}',
      branchNamingPattern: 'feature/{ticketKey}-{slug}',
      prTitleTemplate: '[{ticketKey}] {summary}',
      prDescriptionTemplate: '## Summary\n{summary}',
      reviewerAssignmentRules: { mode: 'manual-list', reviewers: ['alice'] },
      createdAt: '2026-06-15T10:00:00.000Z',
      updatedAt: '2026-06-15T10:00:00.000Z',
    },
  ],
  workflowHistory: [
    {
      id: 'wf-doc-001',
      workflowId: 'wf-001',
      ticketKey: 'AUTO-100',
      state: 'PR_CREATED',
      history: [
        {
          timestamp: '2026-07-01T10:00:00.000Z',
          previousState: 'CREATED',
          newState: 'TICKET_PARSED',
          trigger: 'ticket.parsed',
        },
      ],
      availableTransitions: [],
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T18:00:00.000Z',
    },
  ],
  auditLogs: [
    {
      id: 'audit-001',
      actor: sampleUserProfileExport.id,
      timestamp: '2026-07-01T10:00:00.000Z',
      resource: 'convention_settings/conv-001',
      operation: 'create',
      correlationId: 'corr-export-001',
    },
  ],
  connectedRepositories: [
    {
      id: 'repo-conn-001',
      owner: 'acme',
      repo: 'auto-dev',
      fullName: 'acme/auto-dev',
      defaultBranch: 'main',
      connectedAt: '2026-06-10T08:00:00.000Z',
    },
  ],
};

export const sampleErasureScheduleResponse: ErasureScheduleResponse = {
  requestId: 'erasure-001',
  status: 'pending',
  requestedAt: '2026-07-13T12:00:00.000Z',
  scheduledFor: '2026-07-14T12:00:00.000Z',
  gracePeriodMs: ERASURE_GRACE_PERIOD_MS,
  message:
    'Data erasure scheduled. You may cancel within the 24-hour grace period.',
};

export const sampleCancelErasureResponse: CancelErasureResponse = {
  requestId: 'erasure-001',
  status: 'cancelled',
  cancelledAt: '2026-07-13T14:00:00.000Z',
  message: 'Scheduled data erasure has been cancelled.',
};

export const sampleErasureExecutionSummary: ErasureExecutionSummary = {
  userId: sampleUserProfileExport.id,
  executedAt: '2026-07-14T12:00:00.000Z',
  cryptographicallyErased: {
    oauthTokenFields: 2,
    aiInteractionPayloads: 1,
  },
  purged: {
    sessions: 1,
    conventionSettings: 1,
    workflows: 1,
    connectedRepositories: 1,
    aiInteractionLogs: 1,
    auditRecords: 3,
    userRecord: 1,
  },
};

/** Multi-collection sample dataset for export assembly tests. */
export const sampleDsrUserDataset = {
  profile: sampleUserProfileExport,
  conventionSettings: sampleDataExportResponse.conventionSettings,
  workflowHistory: sampleDataExportResponse.workflowHistory,
  auditLogs: sampleDataExportResponse.auditLogs,
  connectedRepositories: sampleDataExportResponse.connectedRepositories,
};
