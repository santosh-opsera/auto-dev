import { useState } from 'react';
import type { GapItem } from '@autodev/shared-types';

interface TicketGapListProps {
  gaps: GapItem[];
  onResolveGap?: (gap: GapItem, value: string) => void;
}

export function TicketGapList({ gaps, onResolveGap }: TicketGapListProps) {
  if (gaps.length === 0) {
    return (
      <section className="ticket-gap-list" aria-labelledby="gaps-heading">
        <h2 id="gaps-heading">Gap analysis</h2>
        <p className="save-success" role="status">
          No gaps detected. This ticket is ready for codebase analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="ticket-gap-list" aria-labelledby="gaps-heading">
      <h2 id="gaps-heading">Gap analysis</h2>
      <ul className="gap-card-list">
        {gaps.map((gap) => (
          <GapCard key={`${gap.field}-${gap.severity}`} gap={gap} onResolveGap={onResolveGap} />
        ))}
      </ul>
    </section>
  );
}

interface GapCardProps {
  gap: GapItem;
  onResolveGap?: (gap: GapItem, value: string) => void;
}

function GapCard({ gap, onResolveGap }: GapCardProps) {
  const [draft, setDraft] = useState('');
  const severityClass = gap.severity === 'critical' ? 'gap-critical' : 'gap-warning';

  return (
    <li className={`gap-card ${severityClass}`}>
      <div className="gap-card-header">
        <span className="gap-severity" aria-label={`${gap.severity} severity`}>
          {gap.severity}
        </span>
        <strong>{gap.field}</strong>
      </div>
      <p>{gap.description}</p>
      <p className="field-hint">{gap.suggestedAction}</p>
      {gap.severity === 'critical' && gap.field === 'acceptanceCriteria' && onResolveGap ? (
        <div className="gap-resolve-form">
          <label htmlFor={`gap-ac-${gap.field}`}>Add acceptance criteria (one per line)</label>
          <textarea
            id={`gap-ac-${gap.field}`}
            className="field-input"
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={'User can sign in with OAuth\nSession persists for 8 hours'}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => onResolveGap(gap, draft)}
            disabled={!draft.trim()}
          >
            Apply criteria
          </button>
        </div>
      ) : null}
    </li>
  );
}
