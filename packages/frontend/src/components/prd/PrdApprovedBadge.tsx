interface PrdApprovedBadgeProps {
  approvedBy: string;
  approvedAt: string;
}

export function PrdApprovedBadge({ approvedBy, approvedAt }: PrdApprovedBadgeProps) {
  const formatted = new Date(approvedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div
      className="prd-approved-badge"
      role="status"
      aria-label={`PRD approved by ${approvedBy} on ${formatted}`}
    >
      <span className="prd-status-pill prd-status-pill--approved">Approved</span>
      <p>
        Approved by <strong>{approvedBy}</strong> on <time dateTime={approvedAt}>{formatted}</time>
      </p>
    </div>
  );
}
