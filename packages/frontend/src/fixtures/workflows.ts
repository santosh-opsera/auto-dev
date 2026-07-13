export {
  sampleFailedHistory,
  sampleHappyPathHistory,
  samplePausedHistory,
  sampleWorkflowCompleted,
  sampleWorkflowCreated,
  sampleWorkflowFailed,
  sampleWorkflowPaused,
} from '@autodev/shared-types';

import type { WorkflowListResponse, WorkflowResponse } from '@autodev/shared-types';
import {
  sampleHappyPathHistory,
  sampleWorkflowCompleted,
  sampleWorkflowCreated,
  sampleWorkflowFailed,
  sampleWorkflowPaused,
} from '@autodev/shared-types';

export const sampleWorkflowImplementing: WorkflowResponse = {
  id: 'wf-doc-005',
  workflowId: 'workflow-005',
  ticketKey: 'OPL-7005',
  state: 'IMPLEMENTING',
  history: sampleHappyPathHistory.slice(0, 6),
  availableTransitions: ['TESTING', 'PAUSED', 'CANCELLED', 'FAILED'],
  progress: { percent: 35, phase: 'chunk-implementation', chunkId: 'chunk-002' },
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T09:20:00.000Z',
};

export const sampleWorkflowTesting: WorkflowResponse = {
  id: 'wf-doc-006',
  workflowId: 'workflow-006',
  ticketKey: 'OPL-7006',
  state: 'TESTING',
  history: sampleHappyPathHistory.slice(0, 7),
  availableTransitions: ['TEST_PASSED', 'PAUSED', 'CANCELLED', 'FAILED'],
  progress: { percent: 68, phase: 'automated-tests', chunkId: 'chunk-004' },
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T10:05:00.000Z',
};

export const sampleWorkflowAwaitingApproval: WorkflowResponse = {
  id: 'wf-doc-007',
  workflowId: 'workflow-007',
  ticketKey: 'OPL-7007',
  state: 'AWAITING_APPROVAL',
  history: sampleHappyPathHistory.slice(0, 4),
  availableTransitions: ['APPROVED', 'CANCELLED', 'FAILED'],
  progress: { percent: 40, phase: 'approval-gate' },
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T08:10:00.000Z',
};

export const sampleWorkflowCancelled: WorkflowResponse = {
  id: 'wf-doc-008',
  workflowId: 'workflow-008',
  ticketKey: 'OPL-7008',
  state: 'CANCELLED',
  history: [
    ...sampleHappyPathHistory.slice(0, 6),
    {
      timestamp: '2026-07-13T09:40:00.000Z',
      previousState: 'IMPLEMENTING',
      newState: 'CANCELLED',
      trigger: 'user.cancel',
    },
  ],
  availableTransitions: [],
  progress: { percent: 45, phase: 'cancelled' },
  pausedFrom: null,
  resumedFrom: null,
  error: null,
  createdAt: '2026-07-13T08:00:00.000Z',
  updatedAt: '2026-07-13T09:40:00.000Z',
};

export const mockWorkflowList: WorkflowListResponse = {
  workflows: [
    sampleWorkflowCreated,
    sampleWorkflowImplementing,
    sampleWorkflowTesting,
    sampleWorkflowPaused,
    sampleWorkflowAwaitingApproval,
    sampleWorkflowFailed,
    sampleWorkflowCompleted,
    sampleWorkflowCancelled,
  ],
};
