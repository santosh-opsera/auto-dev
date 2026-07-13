import {
  isPausableWorkflowState,
  isTerminalWorkflowState,
  type WorkflowState,
} from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';

/** Happy-path sequential transitions (excluding PAUSED / CANCELLED / FAILED). */
const HAPPY_PATH_TRANSITIONS: Readonly<Partial<Record<WorkflowState, readonly WorkflowState[]>>> = {
  CREATED: ['TICKET_PARSED'],
  TICKET_PARSED: ['ANALYZING'],
  ANALYZING: ['ANALYSIS_COMPLETE'],
  ANALYSIS_COMPLETE: ['AWAITING_APPROVAL'],
  AWAITING_APPROVAL: ['APPROVED'],
  APPROVED: ['IMPLEMENTING'],
  IMPLEMENTING: ['TESTING'],
  TESTING: ['TEST_PASSED'],
  TEST_PASSED: ['PR_CREATING'],
  PR_CREATING: ['PR_CREATED'],
  PR_CREATED: [],
  CANCELLED: [],
};

export interface TransitionContext {
  pausedFrom?: WorkflowState | null;
  failedFrom?: WorkflowState | null;
}

export function getHappyPathTransitions(current: WorkflowState): WorkflowState[] {
  return [...(HAPPY_PATH_TRANSITIONS[current] ?? [])];
}

export function getAvailableTransitions(
  current: WorkflowState,
  context: TransitionContext = {},
): WorkflowState[] {
  if (isTerminalWorkflowState(current)) {
    return [];
  }

  if (current === 'PAUSED') {
    const targets: WorkflowState[] = [];
    if (context.pausedFrom && isPausableWorkflowState(context.pausedFrom)) {
      targets.push(context.pausedFrom);
    }
    targets.push('CANCELLED', 'FAILED');
    return targets;
  }

  if (current === 'FAILED') {
    const targets: WorkflowState[] = [];
    if (context.failedFrom && !isTerminalWorkflowState(context.failedFrom)) {
      targets.push(context.failedFrom);
    }
    targets.push('CANCELLED');
    return targets;
  }

  const next = getHappyPathTransitions(current);

  if (isPausableWorkflowState(current)) {
    next.push('PAUSED');
  }

  next.push('CANCELLED', 'FAILED');
  return next;
}

export function assertValidTransition(
  from: WorkflowState,
  to: WorkflowState,
  context: TransitionContext = {},
): void {
  const available = getAvailableTransitions(from, context);
  if (!available.includes(to)) {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot transition workflow from ${from} to ${to}.`,
      409,
      `Allowed transitions from ${from}: ${available.length > 0 ? available.join(', ') : 'none'}.`,
    );
  }
}

/** Generic /transition only allows happy-path steps; use pause/resume/cancel/fail/retry for control flow. */
export function assertValidHappyPathTransition(from: WorkflowState, to: WorkflowState): void {
  const available = getHappyPathTransitions(from);
  if (!available.includes(to)) {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot transition workflow from ${from} to ${to}.`,
      409,
      `Use the dedicated pause, resume, cancel, fail, or retry endpoints for non-linear transitions. Allowed happy-path targets: ${
        available.length > 0 ? available.join(', ') : 'none'
      }.`,
    );
  }
}

export function assertCanPause(state: WorkflowState): asserts state is 'IMPLEMENTING' | 'TESTING' {
  if (!isPausableWorkflowState(state)) {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot pause workflow from ${state}.`,
      409,
      'Pause is only allowed from IMPLEMENTING or TESTING.',
    );
  }
}

export function assertCanResume(
  state: WorkflowState,
  pausedFrom: WorkflowState | null | undefined,
): WorkflowState {
  if (state !== 'PAUSED') {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot resume workflow from ${state}.`,
      409,
      'Resume is only allowed from PAUSED.',
    );
  }

  if (!pausedFrom || !isPausableWorkflowState(pausedFrom)) {
    throw new AppError(
      'InvalidWorkflowTransition',
      'Paused workflow is missing a valid resume target state.',
      409,
      'Ensure the workflow was paused from IMPLEMENTING or TESTING.',
    );
  }

  return pausedFrom;
}

export function assertCanCancel(state: WorkflowState): void {
  if (isTerminalWorkflowState(state)) {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot cancel workflow in terminal state ${state}.`,
      409,
      'Terminal workflows cannot be cancelled.',
    );
  }
}

export function assertCanFail(state: WorkflowState): void {
  if (isTerminalWorkflowState(state) || state === 'FAILED') {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot mark workflow as failed from ${state}.`,
      409,
      'Only non-terminal, non-failed workflows can transition to FAILED.',
    );
  }
}

export function assertCanRetry(
  state: WorkflowState,
  failedFrom: WorkflowState | null | undefined,
): WorkflowState {
  if (state !== 'FAILED') {
    throw new AppError(
      'InvalidWorkflowTransition',
      `Cannot retry workflow from ${state}.`,
      409,
      'Retry is only allowed from FAILED.',
    );
  }

  if (!failedFrom || isTerminalWorkflowState(failedFrom) || failedFrom === 'FAILED') {
    throw new AppError(
      'InvalidWorkflowTransition',
      'Failed workflow is missing a valid retry target state.',
      409,
      'Ensure the workflow failed from a non-terminal step that can be retried.',
    );
  }

  return failedFrom;
}
