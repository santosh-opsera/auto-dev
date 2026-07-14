interface TicketErrorStateProps {
  error: string;
  ticketKey: string | null;
  onRetry: () => void;
  onConnectJira?: () => void;
  connectJiraLabel?: string;
}

export function TicketErrorState({
  error,
  ticketKey,
  onRetry,
  onConnectJira,
  connectJiraLabel = 'Connect Jira',
}: TicketErrorStateProps) {
  return (
    <section className="ticket-error-state" role="alert">
      <h2>Unable to load ticket{ticketKey ? ` ${ticketKey}` : ''}</h2>
      <p className="page-error">{error}</p>
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
