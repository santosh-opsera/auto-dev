import { getApprovalProgress } from '../../utils/approvalValidation';

interface ApprovalProgressBarProps {
  resolvedCount: number;
  totalCount: number;
}

export function ApprovalProgressBar({ resolvedCount, totalCount }: ApprovalProgressBarProps) {
  const percent = getApprovalProgress(resolvedCount, totalCount);
  const label = `${resolvedCount} of ${totalCount} resolved`;

  return (
    <section className="approval-progress profile-card" aria-labelledby="approval-progress-heading">
      <h2 id="approval-progress-heading">Approval progress</h2>
      <p className="approval-progress-label" id="approval-progress-label">
        {label}
      </p>
      <div
        className="approval-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-labelledby="approval-progress-label"
      >
        <div className="approval-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
