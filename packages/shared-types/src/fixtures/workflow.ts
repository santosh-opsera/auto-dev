import type { WorkflowResponse, WorkflowTransitionRecord } from '../workflow.js';

export const sampleHappyPathHistory: WorkflowTransitionRecord[] = [
  {
    timestamp: '2026-07-13T08:00:00.000Z',
    previousState: 'CREATED',
    newState: 'TICKET_PARSED',
    trigger: 'ticket.parsed',
  },
  {
    timestamp: '2026-07-13T08:01:00.000Z',
    previousState: 'TICKET_PARSED',
    newState: 'ANALYZING',
    trigger: 'analysis.started',
  },
  {
    timestamp: '2026-07-13T08:05:00.000Z',
    previousState: 'ANALYZING',
    newState: 'ANALYSIS_COMPLETE',
    trigger: 'analysis.completed',
  },
  {
    timestamp: '2026-07-13T08:06:00.000Z',
    previousState: 'ANALYSIS_COMPLETE',
    newState: 'AWAITING_APPROVAL',
    trigger: 'approval.requested',
  },
  {
    timestamp: '2026-07-13T09:00:00.000Z',
    previousState: 'AWAITING_APPROVAL',
    newState: 'APPROVED',
    trigger: 'approval.cleared',
  },
  {
    timestamp: '2026-07-13T09:01:00.000Z',
    previousState: 'APPROVED',
    newState: 'IMPLEMENTING',
    trigger: 'implementation.started',
  },
  {
    timestamp: '2026-07-13T10:00:00.000Z',
    previousState: 'IMPLEMENTING',
    newState: 'TESTING',
    trigger: 'testing.started',
  },
  {
    timestamp: '2026-07-13T10:30:00.000Z',
    previousState: 'TESTING',
    newState: 'TEST_PASSED',
    trigger: 'testing.passed',
  },
  {
    timestamp: '2026-07-13T10:31:00.000Z',
    previousState: 'TEST_PASSED',
    newState: 'PR_CREATING',
    trigger: 'pr.creating',
  },
  {
    timestamp: '2026-07-13T10:35:00.000Z',
    previousState: 'PR_CREATING',
    newState: 'PR_CREATED',
    trigger: 'pr.created',
  },
];

export const samplePausedHistory: WorkflowTransitionRecord[] = [
  ...sampleHappyPathHistory.slice(0, 6),
  {
    timestamp: '2026-07-13T09:15:00.000Z',
    previousState: 'IMPLEMENTING',
    newState: 'PAUSED',
    trigger: 'user.pause',
  },
];

export const sampleFailedHistory: WorkflowTransitionRecord[] = [
  ...sampleHappyPathHistory.slice(0, 7),
  {
    timestamp: '2026-07-13T10:10:00.000Z',
    previousState: 'TESTING',
    newState: 'FAILED',
    trigger: 'testing.failed',
  },
];

export const sampleWorkflowCreated: WorkflowResponse = {
  id: 'wf-doc-001',
  workflowId: 'workflow-001',
  ticketKey: 'OPL-7001',
  state: 'CREATED',
  history: [],
  availableTransitions: ['TICKET_PARSED', 'CANCELLED', 'FAILED'],
  progress: undefined,
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T08:00:00.000Z',
};

export const sampleWorkflowPaused: WorkflowResponse = {
  id: 'wf-doc-002',
  workflowId: 'workflow-002',
  ticketKey: 'OPL-7002',
  state: 'PAUSED',
  history: samplePausedHistory,
  availableTransitions: ['IMPLEMENTING', 'CANCELLED', 'FAILED'],
  progress: { percent: 42, phase: 'chunk-implementation', chunkId: 'chunk-003' },
  pausedFrom: 'IMPLEMENTING',
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T09:15:00.000Z',
};

export const sampleWorkflowFailed: WorkflowResponse = {
  id: 'wf-doc-003',
  workflowId: 'workflow-003',
  ticketKey: 'OPL-7003',
  state: 'FAILED',
  history: sampleFailedHistory,
  availableTransitions: ['TESTING', 'CANCELLED'],
  progress: { percent: 70, phase: 'automated-tests' },
  pausedFrom: null,
  resumedFrom: null,
  error: {
    message: 'Integration test suite failed after 3 retries',
    code: 'TEST_SUITE_FAILED',
    failedFrom: 'TESTING',
  },
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T10:10:00.000Z',
};

export const sampleWorkflowCompleted: WorkflowResponse = {
  id: 'wf-doc-004',
  workflowId: 'workflow-004',
  ticketKey: 'OPL-7004',
  state: 'PR_CREATED',
  history: sampleHappyPathHistory,
  availableTransitions: [],
  progress: { percent: 100, phase: 'complete' },
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T10:35:00.000Z',
};
