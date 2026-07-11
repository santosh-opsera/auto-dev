import type { TicketIntent } from '@autodev/shared-types';

interface TicketIntentPanelProps {
  intent: TicketIntent;
}

export function TicketIntentPanel({ intent }: TicketIntentPanelProps) {
  return (
    <section className="ticket-intent-panel" aria-labelledby="intent-heading">
      <h2 id="intent-heading">Parsed ticket intent</h2>
      <dl className="review-summary">
        <div>
          <dt>Ticket key</dt>
          <dd>{intent.ticketKey}</dd>
        </div>
        <div>
          <dt>Problem statement</dt>
          <dd>{intent.problemStatement}</dd>
        </div>
        <div>
          <dt>Proposed approach</dt>
          <dd className="review-multiline">{intent.proposedApproach}</dd>
        </div>
        <div>
          <dt>Acceptance criteria</dt>
          <dd>
            {intent.acceptanceCriteria.length > 0 ? (
              <ul>
                {intent.acceptanceCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            ) : (
              'None extracted'
            )}
          </dd>
        </div>
        <div>
          <dt>Affected components</dt>
          <dd>{intent.affectedComponents.join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Dependencies</dt>
          <dd>{intent.dependencies.join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Constraints</dt>
          <dd>{intent.constraints.join(', ') || 'None'}</dd>
        </div>
        {intent.metadata.issueType ? (
          <div>
            <dt>Issue type</dt>
            <dd>{intent.metadata.issueType}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
