import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DomainEvent } from '@autodev/shared-types';
import { ApprovalExpiryCountdown } from '../components/approvals/ApprovalExpiryCountdown';
import { ApprovalProgressBar } from '../components/approvals/ApprovalProgressBar';
import { DivergenceComparisonCard } from '../components/approvals/DivergenceComparisonCard';
import { GapApprovalCard } from '../components/approvals/GapApprovalCard';
import { useApprovalGate } from '../hooks/useApprovalGate';
import { useSSESubscription } from '../hooks/useSSESubscription';

export function ApprovalGatePage() {
  const { requestId } = useParams<{ requestId: string }>();
  const {
    phase,
    request,
    error,
    liveMessage,
    gaps,
    divergences,
    resolvedCount,
    totalCount,
    canProceed,
    expiresAt,
    resolvingItemId,
    resolveItem,
    handleSseEvent,
    refresh,
  } = useApprovalGate(requestId);

  const onSseEvent = useCallback(
    (event: DomainEvent) => {
      handleSseEvent(event);
    },
    [handleSseEvent],
  );

  useSSESubscription(onSseEvent, Boolean(requestId));

  const handleProceed = (): void => {
    const confirmed = window.confirm(
      'All approval items are resolved. Proceed to implementation?',
    );
    if (!confirmed) {
      return;
    }
    // Implementation pipeline is out of scope for WO-021; confirm clears the gate for the user.
    window.alert('Approval gate cleared. Implementation can proceed.');
  };

  return (
    <main className="approvals-page">
      <header className="dashboard-header">
        <div>
          <h1>Approval gate</h1>
          <p>
            Review gaps and divergences, record decisions, and clear the gate before
            implementation.
          </p>
        </div>
        <nav aria-label="Approval page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
          {' · '}
          <Link to="/tickets" className="text-link">
            Ticket ingestion
          </Link>
        </nav>
      </header>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      {phase === 'loading' || phase === 'idle' ? (
        <section className="profile-card" role="status" aria-live="polite">
          <p>Loading approval request…</p>
        </section>
      ) : null}

      {phase === 'error' && error ? (
        <section className="profile-card ticket-error-state" role="alert">
          <h2>Unable to load approval request</h2>
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      ) : null}

      {phase === 'ready' && request && expiresAt ? (
        <>
          <section className="profile-card approval-meta">
            <dl>
              <div>
                <dt>Ticket</dt>
                <dd>{request.ticketKey}</dd>
              </div>
              <div>
                <dt>Request ID</dt>
                <dd>{request.id}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{request.status}</dd>
              </div>
            </dl>
          </section>

          <ApprovalProgressBar resolvedCount={resolvedCount} totalCount={totalCount} />
          <ApprovalExpiryCountdown expiresAt={expiresAt} />

          <section className="approval-group" aria-labelledby="gaps-group-heading">
            <h2 id="gaps-group-heading">Gaps ({gaps.length})</h2>
            {gaps.length === 0 ? (
              <p className="field-hint" role="status">
                No gap items in this request.
              </p>
            ) : (
              <ul className="gap-card-list">
                {gaps.map((item) => (
                  <GapApprovalCard
                    key={item.itemId}
                    item={item}
                    isResolving={resolvingItemId === item.itemId}
                    onResolve={(input) => resolveItem(item.itemId, input)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="approval-group" aria-labelledby="divergences-group-heading">
            <h2 id="divergences-group-heading">Divergences ({divergences.length})</h2>
            {divergences.length === 0 ? (
              <p className="field-hint" role="status">
                No divergence items in this request.
              </p>
            ) : (
              <ul className="gap-card-list">
                {divergences.map((item) => (
                  <DivergenceComparisonCard
                    key={item.itemId}
                    item={item}
                    isResolving={resolvingItemId === item.itemId}
                    onResolve={(input) => resolveItem(item.itemId, input)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="profile-card approval-proceed" aria-labelledby="proceed-heading">
            <h2 id="proceed-heading">Next step</h2>
            <p role="status">
              {canProceed
                ? 'All items are resolved. You can proceed to implementation.'
                : 'Resolve all pending items before proceeding to implementation.'}
            </p>
            <button
              type="button"
              className="primary-button"
              disabled={!canProceed}
              aria-disabled={!canProceed}
              onClick={handleProceed}
            >
              Proceed to Implementation
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}
