import type { ApprovalAction, ApprovalItem } from '@autodev/shared-types';
import { ApprovalDecisionPanel } from './ApprovalDecisionPanel';

interface DivergenceComparisonCardProps {
  item: ApprovalItem;
  isResolving: boolean;
  onResolve: (input: {
    action: ApprovalAction;
    rationale?: string;
    modifiedValue?: string;
  }) => Promise<boolean> | boolean;
}

export function DivergenceComparisonCard({
  item,
  isResolving,
  onResolve,
}: DivergenceComparisonCardProps) {
  const divergence = item.divergence;
  const severityClass =
    divergence?.severity === 'critical' ? 'gap-critical' : 'gap-warning';

  return (
    <li className={`gap-card approval-item-card divergence-comparison-card ${severityClass}`}>
      <div className="gap-card-header">
        {divergence ? (
          <span className="gap-severity" aria-label={`${divergence.severity} severity`}>
            {divergence.severity}
          </span>
        ) : null}
        <strong>{item.title}</strong>
        <span className="approval-item-status" aria-label={`Status ${item.status}`}>
          {item.status}
        </span>
      </div>
      <p>{item.summary}</p>

      {divergence ? (
        <div className="divergence-comparison-grid">
          <article className="divergence-column" aria-labelledby={`ticket-${item.itemId}`}>
            <h4 id={`ticket-${item.itemId}`}>Ticket approach</h4>
            <p>{divergence.ticketApproach}</p>
          </article>
          <article className="divergence-column" aria-labelledby={`codebase-${item.itemId}`}>
            <h4 id={`codebase-${item.itemId}`}>Codebase convention</h4>
            <p>{divergence.codebaseConvention}</p>
          </article>
          <aside
            className="divergence-recommendation"
            aria-labelledby={`recommendation-${item.itemId}`}
          >
            <h4 id={`recommendation-${item.itemId}`}>Recommendation</h4>
            <p>{divergence.recommendation}</p>
          </aside>
        </div>
      ) : null}

      <ApprovalDecisionPanel item={item} isResolving={isResolving} onResolve={onResolve} />
    </li>
  );
}
