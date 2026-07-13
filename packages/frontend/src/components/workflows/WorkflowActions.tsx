import type { WorkflowState } from '@autodev/shared-types';
import {
  canCancelWorkflow,
  canPauseWorkflow,
  canResumeWorkflow,
} from '../../utils/workflowHelpers';

interface WorkflowActionsProps {
  workflowId: string;
  ticketKey: string;
  state: WorkflowState;
  isActing?: boolean;
  onPause: (workflowId: string) => void | boolean | Promise<boolean>;
  onResume: (workflowId: string) => void | boolean | Promise<boolean>;
  onCancel: (workflowId: string) => void | boolean | Promise<boolean>;
}

export function WorkflowActions({
  workflowId,
  ticketKey,
  state,
  isActing = false,
  onPause,
  onResume,
  onCancel,
}: WorkflowActionsProps) {
  const showPause = canPauseWorkflow(state);
  const showResume = canResumeWorkflow(state);
  const showCancel = canCancelWorkflow(state);

  const handleCancel = (): void => {
    const confirmed = window.confirm(
      `Cancel workflow for ${ticketKey}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    void onCancel(workflowId);
  };

  if (!showPause && !showResume && !showCancel) {
    return (
      <span className="field-hint" role="status">
        No actions available
      </span>
    );
  }

  return (
    <div className="workflow-actions" role="group" aria-label={`Actions for ${ticketKey}`}>
      {showPause ? (
        <button
          type="button"
          className="secondary-button"
          disabled={isActing}
          aria-disabled={isActing}
          aria-label={`Pause workflow ${ticketKey}`}
          onClick={() => void onPause(workflowId)}
        >
          Pause
        </button>
      ) : null}
      {showResume ? (
        <button
          type="button"
          className="primary-button"
          disabled={isActing}
          aria-disabled={isActing}
          aria-label={`Resume workflow ${ticketKey}`}
          onClick={() => void onResume(workflowId)}
        >
          Resume
        </button>
      ) : null}
      {showCancel ? (
        <button
          type="button"
          className="secondary-button workflow-cancel-button"
          disabled={isActing}
          aria-disabled={isActing}
          aria-label={`Cancel workflow ${ticketKey}`}
          onClick={handleCancel}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
