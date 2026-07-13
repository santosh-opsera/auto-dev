import { useEffect, useId, useRef, useState } from 'react';
import type { ApprovalAction, ApprovalItem } from '@autodev/shared-types';
import {
  validateApprovalDecision,
  type ApprovalDecisionErrors,
} from '../../utils/approvalValidation';

interface ApprovalDecisionPanelProps {
  item: ApprovalItem;
  isResolving: boolean;
  onResolve: (input: {
    action: ApprovalAction;
    rationale?: string;
    modifiedValue?: string;
  }) => Promise<boolean> | boolean;
}

const ACTION_LABELS: Record<ApprovalAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  modify: 'Modify',
};

export function ApprovalDecisionPanel({
  item,
  isResolving,
  onResolve,
}: ApprovalDecisionPanelProps) {
  const baseId = useId();
  const rationaleRef = useRef<HTMLTextAreaElement>(null);
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [rationale, setRationale] = useState('');
  const [modifiedValue, setModifiedValue] = useState('');
  const [errors, setErrors] = useState<ApprovalDecisionErrors | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isPending = item.status === 'pending';

  useEffect(() => {
    if (selectedAction && rationaleRef.current) {
      rationaleRef.current.focus();
    }
  }, [selectedAction]);

  if (!isPending) {
    return (
      <div className="approval-decision-resolved" role="status">
        <p>
          Status: <strong>{item.status}</strong>
          {item.decision?.action ? ` (${item.decision.action})` : null}
        </p>
        {item.decision?.rationale ? <p className="field-hint">{item.decision.rationale}</p> : null}
        {item.decision?.modifiedValue ? (
          <p className="field-hint">Modified value: {item.decision.modifiedValue}</p>
        ) : null}
      </div>
    );
  }

  const handleSelectAction = (action: ApprovalAction): void => {
    setSelectedAction(action);
    setErrors(undefined);
    setStatusMessage(null);
    if (action !== 'modify') {
      setModifiedValue('');
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedAction) {
      return;
    }

    const input = {
      action: selectedAction,
      rationale,
      modifiedValue: selectedAction === 'modify' ? modifiedValue : undefined,
    };
    const validationErrors = validateApprovalDecision(input);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    const success = await onResolve(input);
    if (success) {
      setStatusMessage(`Decision recorded: ${ACTION_LABELS[selectedAction]}.`);
      setSelectedAction(null);
      setRationale('');
      setModifiedValue('');
      setErrors(undefined);
    }
  };

  return (
    <div className="approval-decision-panel">
      <div className="approval-action-buttons" role="group" aria-label={`Actions for ${item.title}`}>
        {(Object.keys(ACTION_LABELS) as ApprovalAction[]).map((action) => (
          <button
            key={action}
            type="button"
            className={
              selectedAction === action
                ? 'secondary-button approval-action-selected'
                : 'secondary-button'
            }
            aria-pressed={selectedAction === action}
            disabled={isResolving}
            onClick={() => handleSelectAction(action)}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {selectedAction ? (
        <div className="approval-decision-form">
          <label htmlFor={`${baseId}-rationale`}>
            Rationale
            {selectedAction === 'approve' ? ' (optional)' : ' (required)'}
          </label>
          <textarea
            id={`${baseId}-rationale`}
            ref={rationaleRef}
            className={`field-input ${errors?.rationale ? 'field-input-error' : ''}`}
            rows={3}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            aria-invalid={Boolean(errors?.rationale)}
            aria-describedby={errors?.rationale ? `${baseId}-rationale-error` : undefined}
          />
          {errors?.rationale ? (
            <p id={`${baseId}-rationale-error`} className="field-error" role="alert">
              {errors.rationale}
            </p>
          ) : null}

          {selectedAction === 'modify' ? (
            <>
              <label htmlFor={`${baseId}-modified`}>
                Modified value (required)
              </label>
              <textarea
                id={`${baseId}-modified`}
                className={`field-input ${errors?.modifiedValue ? 'field-input-error' : ''}`}
                rows={3}
                value={modifiedValue}
                onChange={(event) => setModifiedValue(event.target.value)}
                aria-invalid={Boolean(errors?.modifiedValue)}
                aria-describedby={
                  errors?.modifiedValue ? `${baseId}-modified-error` : undefined
                }
                placeholder={
                  item.type === 'gap'
                    ? 'Provide the missing information'
                    : 'Describe your alternative approach'
                }
              />
              {errors?.modifiedValue ? (
                <p id={`${baseId}-modified-error`} className="field-error" role="alert">
                  {errors.modifiedValue}
                </p>
              ) : null}
            </>
          ) : null}

          <button
            type="button"
            className="primary-button"
            disabled={isResolving}
            onClick={() => void handleSubmit()}
          >
            {isResolving ? 'Submitting…' : `Confirm ${ACTION_LABELS[selectedAction]}`}
          </button>
        </div>
      ) : (
        <p className="field-hint">Select Approve, Reject, or Modify to continue.</p>
      )}

      {statusMessage ? (
        <p className="save-success" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
