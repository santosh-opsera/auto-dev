interface TicketErrorStateProps {
  error: string;
  ticketKey: string | null;
  onRetry: () => void;
  /** Primary CTA for connect / re-authorize flows. */
  onConnectJira?: () => void;
  connectJiraLabel?: string;
  /** Server-provided suggestedAction (shown under the error). */
  suggestedAction?: string | null;
}

export function TicketErrorState({
  error,
  ticketKey,
  onRetry,
  onConnectJira,
  connectJiraLabel = 'Connect Jira',
  suggestedAction,
}: TicketErrorStateProps) {
  return (
    <section className="ticket-error-state" role="alert">
      <h2>Unable to load ticket{ticketKey ? ` ${ticketKey}` : ''}</h2>
      <p className="page-error">{error}</p>
      {suggestedAction ? <p className="field-hint">{suggestedAction}</p> : null}
      <div className="wizard-actions">
        {onConnectJira ? (
          <button type="button" className="primary-button" onClick={onConnectJira}>
            {connectJiraLabel}
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </section>
  );
}
