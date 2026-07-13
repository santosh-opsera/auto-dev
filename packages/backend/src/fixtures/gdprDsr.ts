import {
  sampleCancelErasureResponse,
  sampleDataExportResponse,
  sampleDsrUserDataset,
  sampleErasureExecutionSummary,
  sampleErasureScheduleResponse,
  sampleUpdateUserProfileInput,
  sampleUserProfileExport,
  ERASURE_GRACE_PERIOD_MS,
} from '@autodev/shared-types';

export {
  sampleCancelErasureResponse,
  sampleDataExportResponse,
  sampleDsrUserDataset,
  sampleErasureExecutionSummary,
  sampleErasureScheduleResponse,
  sampleUpdateUserProfileInput,
  sampleUserProfileExport,
  ERASURE_GRACE_PERIOD_MS,
};

/** Seed rows spanning collections used by data-export assembly tests. */
export const sampleCrossCollectionUserData = {
  user: {
    email: sampleUserProfileExport.email,
    displayName: sampleUserProfileExport.displayName,
    role: 'user' as const,
    connectedProviders: ['github'] as Array<'github' | 'atlassian'>,
  },
  convention: sampleDataExportResponse.conventionSettings[0]!,
  workflow: {
    workflowId: 'wf-dsr-001',
    ticketKey: 'AUTO-100',
    state: 'CREATED' as const,
    history: [] as Array<{
      timestamp: Date;
      previousState: 'CREATED';
      newState: 'TICKET_PARSED';
      trigger: string;
    }>,
  },
  repository: {
    owner: 'acme',
    repo: 'auto-dev',
    fullName: 'acme/auto-dev',
    defaultBranch: 'main',
  },
  audit: {
    resource: 'convention_settings/seed',
    operation: 'create' as const,
    correlationId: 'corr-dsr-fixture-001',
  },
};
