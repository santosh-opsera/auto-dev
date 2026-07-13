import type { DomainEvent } from '../events.js';

export const sampleEventMetadata = {
  eventId: 'event-001',
  correlationId: 'corr-event-001',
  actor: 'user-001',
  userId: 'user-001',
  timestamp: '2026-07-11T08:00:00.000Z',
};

export const sampleConventionUpdatedEvent: DomainEvent = {
  type: 'CONVENTION_UPDATED',
  payload: {
    settingsId: 'settings-001',
    version: 2,
  },
  metadata: sampleEventMetadata,
};

export const sampleConventionValidationEvent: DomainEvent = {
  type: 'CONVENTION_VALIDATION',
  payload: {
    workflowId: 'workflow-001',
    artifactType: 'branch',
    passed: true,
    corrected: false,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-001b',
  },
};

export const sampleChunkCreatedEvent: DomainEvent = {
  type: 'CHUNK_CREATED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    prdId: 'prd-003',
    name: 'Data model and shared types',
    order: 0,
    status: 'PENDING',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002a',
  },
};

export const sampleChunkProgressEvent: DomainEvent = {
  type: 'CHUNK_PROGRESS',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    status: 'in_progress',
    progressPercent: 45,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002',
  },
};

export const sampleTestingStartedEvent: DomainEvent = {
  type: 'TESTING_STARTED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    maxIterations: 5,
    framework: 'vitest',
    testCount: 3,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002b',
  },
};

export const sampleTestingIterationEvent: DomainEvent = {
  type: 'TESTING_ITERATION',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iteration: 1,
    maxIterations: 5,
    passed: false,
    failedCount: 1,
    identifiedIssues: ['add subtracts operands'],
    fixesApplied: 1,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002c',
  },
};

export const sampleTestingPassedEvent: DomainEvent = {
  type: 'TESTING_PASSED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iterationsUsed: 2,
    coveragePercent: 80.75,
    passedCount: 3,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002d',
  },
};

export const sampleTestingFailedEvent: DomainEvent = {
  type: 'TESTING_FAILED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iterationsUsed: 5,
    maxIterations: 5,
    failedCount: 1,
    rootCauseSummary: 'Max iterations exhausted with failing tests.',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002e',
  },
};

export const samplePrCreatedEvent: DomainEvent = {
  type: 'PR_CREATED',
  payload: {
    workflowId: 'workflow-001',
    prUrl: 'https://github.com/santosh-opsera/auto-dev/pull/42',
    prNumber: 42,
    reviewers: ['octocat', 'hubot'],
    title: 'OPL-1234 Add user auth',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002f',
  },
};

export const sampleTicketParsedEvent: DomainEvent = {
  type: 'TICKET_PARSED',
  payload: {
    ticketKey: 'OPL-1234',
    summary: 'Add OAuth support',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-003',
  },
};

export const sampleWorkflowTransitionedEvent: DomainEvent = {
  type: 'WORKFLOW_TRANSITIONED',
  payload: {
    workflowId: 'workflow-001',
    previousState: 'CREATED',
    newState: 'TICKET_PARSED',
    trigger: 'ticket.parsed',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-004',
  },
};

export const sampleWorkflowFailedEvent: DomainEvent = {
  type: 'WORKFLOW_FAILED',
  payload: {
    workflowId: 'workflow-001',
    previousState: 'TESTING',
    error: {
      message: 'Integration test suite failed',
      code: 'TEST_SUITE_FAILED',
      failedFrom: 'TESTING',
    },
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-005',
  },
};

export const sampleDependencyUpdateAvailableEvent: DomainEvent = {
  type: 'DEPENDENCY_UPDATE_AVAILABLE',
  payload: {
    proposalId: 'dep-update-sample-001',
    packageName: '@autodev/shared-utils',
    currentVersion: '^1.2.3',
    proposedVersion: '1.3.0',
    changelogLink:
      'https://www.npmjs.com/package/%40autodev%2Fshared-utils?activeTab=versions#1.3.0',
    owner: 'acme',
    repo: 'web-app',
    packagePath: 'package.json',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-006',
  },
};

export const sampleDeploymentStartedEvent: DomainEvent = {
  type: 'DEPLOYMENT_STARTED',
  payload: {
    deploymentId: 'deployment-001',
    workflowId: 'workflow-001',
    branch: 'feature/qa-handoff',
    baseUrl: 'http://localhost:4000',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-007',
  },
};

export const sampleDeploymentCompletedEvent: DomainEvent = {
  type: 'DEPLOYMENT_COMPLETED',
  payload: {
    deploymentId: 'deployment-001',
    workflowId: 'workflow-001',
    branch: 'feature/qa-handoff',
    baseUrl: 'http://localhost:4000',
    status: 'RUNNING',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-008',
  },
};

export const sampleDeploymentFailedEvent: DomainEvent = {
  type: 'DEPLOYMENT_FAILED',
  payload: {
    deploymentId: 'deployment-002',
    workflowId: 'workflow-001',
    branch: 'feature/qa-handoff',
    baseUrl: 'http://localhost:4000',
    errorMessage: 'Docker Compose build failed',
    errorCode: 'DEPLOY_BUILD_FAILED',
    phase: 'BUILDING',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-009',
  },
};

export const sampleQaHandoffReadyEvent: DomainEvent = {
  type: 'QA_HANDOFF_READY',
  payload: {
    handoffId: 'handoff-001',
    workflowId: 'workflow-001',
    ticketKey: 'OPL-1234',
    deploymentUrl: 'http://localhost:4000',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-010',
  },
};

export const sampleQaHandoffApprovedEvent: DomainEvent = {
  type: 'QA_HANDOFF_APPROVED',
  payload: {
    handoffId: 'handoff-001',
    workflowId: 'workflow-001',
    ticketKey: 'OPL-1234',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-011',
  },
};

export const sampleQaChangesRequestedEvent: DomainEvent = {
  type: 'QA_CHANGES_REQUESTED',
  payload: {
    handoffId: 'handoff-001',
    workflowId: 'workflow-001',
    ticketKey: 'OPL-1234',
    feedbackItems: [
      {
        id: 'fb-1',
        description: 'Session expiry edge case fails when clock skew exceeds 2 minutes',
        checklistItemId: 'ac-2',
      },
    ],
    feedbackCount: 1,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-012',
  },
};
