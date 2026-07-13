import {
  isPausableWorkflowState,
  isTerminalWorkflowState,
  type WorkflowResponse,
  type WorkflowState,
} from '@autodev/shared-types';
import { getAppLocale } from '../store/localeStore';
import { formatDate } from './localeFormat';

export type WorkflowFilterCategory =
  | 'all'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowBadgeTone =
  | 'progressing'
  | 'awaiting'
  | 'failed'
  | 'cancelled'
  | 'completed';

export const WORKFLOW_FILTER_OPTIONS: Array<{ value: WorkflowFilterCategory; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATE_LABELS: Record<WorkflowState, string> = {
  CREATED: 'Created',
  TICKET_PARSED: 'Ticket parsed',
  ANALYZING: 'Analyzing',
  ANALYSIS_COMPLETE: 'Analysis complete',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  IMPLEMENTING: 'Implementing',
  TESTING: 'Testing',
  TEST_PASSED: 'Tests passed',
  PR_CREATING: 'Creating PR',
  PR_CREATED: 'PR created',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

export function formatWorkflowState(state: WorkflowState): string {
  return STATE_LABELS[state] ?? state;
}

export function getWorkflowTitle(workflow: WorkflowResponse): string {
  if (workflow.progress?.phase) {
    return workflow.progress.phase;
  }
  return formatWorkflowState(workflow.state);
}

export function getWorkflowBadgeTone(state: WorkflowState): WorkflowBadgeTone {
  if (state === 'CANCELLED') {
    return 'cancelled';
  }
  if (state === 'FAILED') {
    return 'failed';
  }
  if (state === 'PAUSED' || state === 'AWAITING_APPROVAL') {
    return 'awaiting';
  }
  if (state === 'PR_CREATED') {
    return 'completed';
  }
  return 'progressing';
}

export function canPauseWorkflow(state: WorkflowState): boolean {
  return isPausableWorkflowState(state);
}

export function canResumeWorkflow(state: WorkflowState): boolean {
  return state === 'PAUSED';
}

export function canCancelWorkflow(state: WorkflowState): boolean {
  return !isTerminalWorkflowState(state);
}

export function matchesWorkflowFilter(
  workflow: WorkflowResponse,
  filter: WorkflowFilterCategory,
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'paused':
      return workflow.state === 'PAUSED';
    case 'completed':
      return workflow.state === 'PR_CREATED';
    case 'failed':
      return workflow.state === 'FAILED';
    case 'cancelled':
      return workflow.state === 'CANCELLED';
    case 'active':
      return (
        workflow.state !== 'PAUSED' &&
        workflow.state !== 'PR_CREATED' &&
        workflow.state !== 'FAILED' &&
        workflow.state !== 'CANCELLED'
      );
    default:
      return true;
  }
}

export function filterWorkflows(
  workflows: WorkflowResponse[],
  filter: WorkflowFilterCategory,
): WorkflowResponse[] {
  return workflows.filter((workflow) => matchesWorkflowFilter(workflow, filter));
}

export function formatWorkflowTimestamp(iso: string, locale?: string | null): string {
  return formatDate(iso, locale ?? getAppLocale());
}
