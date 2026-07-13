import type { ApprovalAction, ApprovalItem } from '@autodev/shared-types';
import { ApprovalDecisionPanel } from './ApprovalDecisionPanel';

interface GapApprovalCardProps {
  item: ApprovalItem;
  isResolving: boolean;
  onResolve: (input: {
    action: ApprovalAction;
    rationale?: string;
    modifiedValue?: string;
  }) => Promise<boolean> | boolean;
}

export function GapApprovalCard({ item, isResolving, onResolve }: GapApprovalCardProps) {
  const gap = item.gap;
  const severity = gap?.severity ?? 'warning';
  const severityClass = severity === 'critical' ? 'gap-critical' : 'gap-warning';

  return (
    <li className={`gap-card approval-item-card gap-approval-card ${severityClass}`}>
      <div className="gap-card-header">
        <span className="gap-severity" aria-label={`${severity} severity`}>
          {severity}
        </span>
        <strong>{gap?.field ?? item.sourceRef}</strong>
        <span className="approval-item-status" aria-label={`Status ${item.status}`}>
          {item.status}
        </span>
      </div>
      <p>{item.summary}</p>
      {gap?.suggestedAction ? <p className="field-hint">{gap.suggestedAction}</p> : null}
      <p className="field-hint">
        Use Modify to supply the missing information; the value is sent as modifiedValue.
      </p>
      <ApprovalDecisionPanel item={item} isResolving={isResolving} onResolve={onResolve} />
    </li>
  );
}
