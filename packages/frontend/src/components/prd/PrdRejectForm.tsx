import { useState } from 'react';

interface PrdRejectFormProps {
  isRejecting: boolean;
  onReject: (reason: string) => Promise<boolean>;
  onCancel: () => void;
}

export function PrdRejectForm({ isRejecting, onReject, onCancel }: PrdRejectFormProps) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!reason.trim()) {
      setLocalError('A rejection reason is required.');
      return;
    }
    setLocalError(null);
    const ok = await onReject(reason);
    if (!ok && !localError) {
      setLocalError('Unable to reject this PRD.');
    }
  };

  return (
    <form
      className="prd-reject-form"
      aria-labelledby="prd-reject-heading"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h3 id="prd-reject-heading">Reject PRD</h3>
      <p className="field-hint">
        Rejection marks this version for regeneration. Provide a clear reason for the product owner
        and generation retry.
      </p>
      <label htmlFor="prd-reject-reason">Rejection reason</label>
      <textarea
        id="prd-reject-reason"
        className="prd-section-textarea"
        rows={4}
        value={reason}
        aria-required="true"
        aria-invalid={Boolean(localError)}
        aria-describedby={localError ? 'prd-reject-error' : undefined}
        onChange={(event) => {
          setReason(event.target.value);
          if (localError) {
            setLocalError(null);
          }
        }}
      />
      {localError ? (
        <p id="prd-reject-error" className="field-error" role="alert">
          {localError}
        </p>
      ) : null}
      <div className="prd-action-row">
        <button type="submit" className="primary-button" disabled={isRejecting}>
          {isRejecting ? 'Rejecting…' : 'Confirm reject'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={isRejecting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
