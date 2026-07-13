import type { WorkflowState } from '@autodev/shared-types';
import {
  formatWorkflowState,
  getWorkflowBadgeTone,
} from '../../utils/workflowHelpers';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
}

export function WorkflowStateBadge({ state }: WorkflowStateBadgeProps) {
  const tone = getWorkflowBadgeTone(state);
  const label = formatWorkflowState(state);

  return (
    <span
      className={`workflow-state-badge workflow-state-badge--${tone}`}
      data-tone={tone}
      data-state={state}
      aria-label={`Workflow state: ${label}`}
    >
      {label}
    </span>
  );
}
