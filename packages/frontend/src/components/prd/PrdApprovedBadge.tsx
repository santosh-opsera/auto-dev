import { useLocaleStore } from '../../store/localeStore';
import { formatDate } from '../../utils/localeFormat';

interface PrdApprovedBadgeProps {
  approvedBy: string;
  approvedAt: string;
}

export function PrdApprovedBadge({ approvedBy, approvedAt }: PrdApprovedBadgeProps) {
  const locale = useLocaleStore((state) => state.locale);
  const formatted = formatDate(approvedAt, locale);

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
