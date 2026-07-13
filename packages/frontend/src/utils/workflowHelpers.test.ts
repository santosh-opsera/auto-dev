import { describe, expect, it } from 'vitest';
import {
  canCancelWorkflow,
  canPauseWorkflow,
  canResumeWorkflow,
  filterWorkflows,
  getWorkflowBadgeTone,
  getWorkflowTitle,
  matchesWorkflowFilter,
} from './workflowHelpers';
import {
  sampleWorkflowAwaitingApproval,
  sampleWorkflowCancelled,
  sampleWorkflowCompleted,
  sampleWorkflowFailed,
  sampleWorkflowImplementing,
  sampleWorkflowPaused,
  sampleWorkflowTesting,
  mockWorkflowList,
} from '../fixtures/workflows';

describe('workflowHelpers badge tones', () => {
  it('maps progressing states to green tone', () => {
    expect(getWorkflowBadgeTone('IMPLEMENTING')).toBe('progressing');
    expect(getWorkflowBadgeTone('TESTING')).toBe('progressing');
    expect(getWorkflowBadgeTone('CREATED')).toBe('progressing');
  });

  it('maps paused and awaiting to yellow tone', () => {
    expect(getWorkflowBadgeTone('PAUSED')).toBe('awaiting');
    expect(getWorkflowBadgeTone('AWAITING_APPROVAL')).toBe('awaiting');
  });

  it('maps failed to red and cancelled to gray', () => {
    expect(getWorkflowBadgeTone('FAILED')).toBe('failed');
    expect(getWorkflowBadgeTone('CANCELLED')).toBe('cancelled');
  });

  it('maps completed PR_CREATED to completed tone', () => {
    expect(getWorkflowBadgeTone('PR_CREATED')).toBe('completed');
  });
});

describe('workflowHelpers action visibility', () => {
  it('shows pause only for IMPLEMENTING or TESTING', () => {
    expect(canPauseWorkflow('IMPLEMENTING')).toBe(true);
    expect(canPauseWorkflow('TESTING')).toBe(true);
    expect(canPauseWorkflow('PAUSED')).toBe(false);
    expect(canPauseWorkflow('FAILED')).toBe(false);
    expect(canPauseWorkflow('PR_CREATED')).toBe(false);
  });

  it('shows resume only for PAUSED', () => {
    expect(canResumeWorkflow('PAUSED')).toBe(true);
    expect(canResumeWorkflow('IMPLEMENTING')).toBe(false);
    expect(canResumeWorkflow('CANCELLED')).toBe(false);
  });

  it('shows cancel for non-terminal states', () => {
    expect(canCancelWorkflow('IMPLEMENTING')).toBe(true);
    expect(canCancelWorkflow('PAUSED')).toBe(true);
    expect(canCancelWorkflow('FAILED')).toBe(true);
    expect(canCancelWorkflow('PR_CREATED')).toBe(false);
    expect(canCancelWorkflow('CANCELLED')).toBe(false);
  });
});

describe('workflowHelpers filters', () => {
  it('filters by category', () => {
    expect(matchesWorkflowFilter(sampleWorkflowPaused, 'paused')).toBe(true);
    expect(matchesWorkflowFilter(sampleWorkflowCompleted, 'completed')).toBe(true);
    expect(matchesWorkflowFilter(sampleWorkflowFailed, 'failed')).toBe(true);
    expect(matchesWorkflowFilter(sampleWorkflowCancelled, 'cancelled')).toBe(true);
    expect(matchesWorkflowFilter(sampleWorkflowImplementing, 'active')).toBe(true);
    expect(matchesWorkflowFilter(sampleWorkflowPaused, 'active')).toBe(false);
  });

  it('returns matching workflows for active filter', () => {
    const active = filterWorkflows(mockWorkflowList.workflows, 'active');
    expect(active.every((workflow) => matchesWorkflowFilter(workflow, 'active'))).toBe(true);
    expect(active.some((workflow) => workflow.state === 'IMPLEMENTING')).toBe(true);
  });
});

describe('workflowHelpers title', () => {
  it('prefers progress phase when present', () => {
    expect(getWorkflowTitle(sampleWorkflowTesting)).toBe('automated-tests');
    expect(getWorkflowTitle(sampleWorkflowAwaitingApproval)).toBe('approval-gate');
  });
});
