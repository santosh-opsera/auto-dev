interface TicketErrorStateProps {
  error: string;
  ticketKey: string | null;
  onRetry: () => void;
  onConnectJira?: () => void;
  connectJiraLabel?: string;
  suggestedAction?: string | null;
  errorCode?: string | null;
}

function severityForErrorCode(errorCode: string | null | undefined): 'critical' | 'warning' | 'info' {
  switch (errorCode) {
    case 'AtlassianTokenExpired':
    case 'AtlassianTokenRevoked':
    case 'AtlassianRefreshInvalid':
    case 'AtlassianReauthorizeRequired':
    case 'JiraPermissionDenied':
      return 'critical';
    case 'JiraRateLimited':
    case 'JiraNetworkError':
      return 'warning';
    case 'JiraTicketNotFound':
    case 'JiraNotConnected':
    default:
      return 'info';
  }
}

export function TicketErrorState({
  error,
  ticketKey,
  onRetry,
  onConnectJira,
  connectJiraLabel = 'Connect Jira',
  suggestedAction,
  errorCode,
}: TicketErrorStateProps) {
  const severity = severityForErrorCode(errorCode);

  return (
    <section className={`ticket-error-state ticket-error-${severity}`} role="alert">
      <h2>Unable to load ticket{ticketKey ? ` ${ticketKey}` : ''}</h2>
      <p className="page-error">{error}</p>
      {suggestedAction ? <p className="field-hint ticket-error-action">{suggestedAction}</p> : null}
      <p className={`ticket-error-severity ticket-error-severity-${severity}`} aria-hidden="true">
        {severity === 'critical' ? '!' : severity === 'warning' ? '!' : 'i'}
      </p>
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
