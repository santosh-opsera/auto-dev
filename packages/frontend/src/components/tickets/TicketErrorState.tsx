interface TicketErrorStateProps {
  error: string;
  ticketKey: string | null;
  onRetry: () => void;
  onManualFallback: () => void;
  onManualEntry: () => void;
  onConnectJira?: () => void;
}

export function TicketErrorState({
  error,
  ticketKey,
  onRetry,
  onManualFallback,
  onManualEntry,
  onConnectJira,
}: TicketErrorStateProps) {
  return (
    <section className="ticket-error-state" role="alert">
      <h2>Unable to load ticket{ticketKey ? ` ${ticketKey}` : ''}</h2>
      <p className="page-error">{error}</p>
      <div className="wizard-actions">
        {onConnectJira ? (
          <button type="button" className="primary-button" onClick={onConnectJira}>
            Connect Jira permissions
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={onRetry}>
            Retry
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onManualFallback}>
          Retry with Jira REST fallback
        </button>
      </div>
      <p>
        <button type="button" className="text-link" onClick={onManualEntry}>
          Enter ticket key manually
        </button>
      </p>
    </section>
  );
}
