import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCurrentUser, getJiraConnectUrl } from '../api/auth';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { TicketEmptyState } from '../components/tickets/TicketEmptyState';
import { TicketErrorState } from '../components/tickets/TicketErrorState';
import { TicketGapList } from '../components/tickets/TicketGapList';
import { TicketIntentPanel } from '../components/tickets/TicketIntentPanel';
import { TicketKeyForm } from '../components/tickets/TicketKeyForm';
import { TicketParsingSkeleton } from '../components/tickets/TicketParsingSkeleton';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';
import { useTicketIngestion } from '../hooks/useTicketIngestion';
import { useAuthStore } from '../store/authStore';

const TICKETS_RETURN_PATH = '/tickets';

const REAUTHORIZE_ERROR_CODES = new Set([
  'AtlassianReauthorizeRequired',
  'AtlassianSessionExpired',
  'AtlassianTokenRevoked',
  'AtlassianRefreshInvalid',
]);

interface TicketIngestPageProps {
  onLogoutComplete: () => void;
}

export function TicketIngestPage({ onLogoutComplete }: TicketIngestPageProps) {
  const {
    phase,
    ticketKey,
    ticket,
    error,
    errorCode,
    suggestedAction,
    progressMessage,
    displayIntent,
    displayGaps,
    canProceed,
    ingestTicket,
    retry,
    reset,
    handleSseProgress,
    resolveGap,
  } = useTicketIngestion();

  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthDeniedMessage, setOauthDeniedMessage] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const jiraConnected = user?.integrations?.jira ?? false;
  const needsReauthorize = errorCode !== null && REAUTHORIZE_ERROR_CODES.has(errorCode);
  const needsFirstTimeConnect =
    errorCode === 'JiraNotConnected' || (user !== null && !jiraConnected && !needsReauthorize);
  const needsJiraConnect = needsFirstTimeConnect || needsReauthorize;
  const hasAtlassianProvider = user?.connectedProviders.includes('atlassian') === true;
  const jiraConnectUrl = getJiraConnectUrl(TICKETS_RETURN_PATH);
  const connectJiraLabel = needsReauthorize ? 'Re-authorize Jira' : 'Connect Jira';

  useSessionHeartbeat(true);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    const reason = searchParams.get('reason');

    if (oauthError === 'atlassian_oauth') {
      setOauthDeniedMessage(
        reason
          ? `Jira authorization failed (${reason}). Grant the requested permissions and try again.`
          : 'Jira authorization was denied. Grant the requested permissions and try again.',
      );
      setSearchParams({}, { replace: true });
      return;
    }

    void fetchCurrentUser()
      .then(({ user: nextUser, session }) => {
        setAuth(nextUser, session);
      })
      .catch(() => {
        // Keep existing auth store if /me fails (e.g. transient network).
      });
  }, [searchParams, setAuth, setSearchParams]);

  const onSseEvent = useCallback(
    (event: { type: string; payload: { ticketKey?: string; summary?: string } }) => {
      if (event.type === 'TICKET_PARSED' && event.payload.ticketKey) {
        handleSseProgress(
          event.payload.ticketKey,
          `Received TICKET_PARSED event for ${event.payload.ticketKey}`,
        );
      }
    },
    [handleSseProgress],
  );

  useSSE({ enabled: true, onEvent: onSseEvent });

  const isLoading = phase === 'fetching' || phase === 'parsing';

  const handleSubmit = (key: string): void => {
    setOauthDeniedMessage(null);
    void ingestTicket(key);
  };

  return (
    <main className="tickets-page">
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

      <header className="dashboard-header">
        <div>
          <h1>Ticket ingestion</h1>
          <p>Select a Jira ticket, review parsed intent, and resolve gaps before analysis.</p>
        </div>
        <nav aria-label="Ticket page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      {oauthDeniedMessage ? (
        <section className="profile-card ticket-error-state" role="alert">
          <h2>Jira authorization incomplete</h2>
          <p className="page-error">{oauthDeniedMessage}</p>
          <div className="wizard-actions">
            <a href={jiraConnectUrl} className="primary-link">
              Retry Jira authorization
            </a>
          </div>
        </section>
      ) : null}

      {needsJiraConnect ? (
        <section className="profile-card jira-connect-banner" role="status">
          <h2>{needsReauthorize ? 'Jira re-authorization required' : 'Jira access required'}</h2>
          <p>
            {needsReauthorize
              ? 'Your Jira session expired or was revoked. Reconnect Jira to continue loading tickets.'
              : hasAtlassianProvider
                ? 'Your Atlassian account is signed in, but Jira read permissions are not granted yet. Connect Jira before loading tickets.'
                : 'GitHub sign-in does not include Jira access. Link your Atlassian account and grant Jira read permissions before loading tickets.'}
          </p>
          <a href={jiraConnectUrl} className="primary-link">
            {connectJiraLabel}
          </a>
        </section>
      ) : null}

      {phase === 'idle' || phase === 'error' ? <TicketEmptyState /> : null}

      <section className="ticket-search-panel profile-card">
        <TicketKeyForm onSubmit={handleSubmit} isSubmitting={isLoading} initialValue={ticketKey ?? ''} />
        {phase === 'complete' ? (
          <button type="button" className="secondary-button" onClick={reset}>
            Select another ticket
          </button>
        ) : null}
      </section>

      {isLoading && ticketKey ? (
        <TicketParsingSkeleton ticketKey={ticketKey} progressMessage={progressMessage} />
      ) : null}

      {phase === 'error' && error ? (
        <TicketErrorState
          error={error}
          ticketKey={ticketKey}
          suggestedAction={suggestedAction}
          onRetry={() => void retry()}
          onConnectJira={
            needsJiraConnect || needsReauthorize || errorCode === 'JiraNotConnected'
              ? () => window.location.assign(jiraConnectUrl)
              : undefined
          }
          connectJiraLabel={
            needsReauthorize ||
            errorCode === 'AtlassianTokenRevoked' ||
            errorCode === 'AtlassianRefreshInvalid'
              ? 'Re-authorize Jira'
              : 'Connect Jira'
          }
        />
      ) : null}

      {phase === 'complete' && displayIntent ? (
        <>
          {ticket ? (
            <section className="profile-card ticket-source-badge">
              <p>
                Loaded from <strong>{ticket.source}</strong>
              </p>
            </section>
          ) : null}
          <TicketIntentPanel intent={displayIntent} />
          <TicketGapList gaps={displayGaps} onResolveGap={resolveGap} />
          <section className="profile-card">
            <p role="status">
              {canProceed
                ? 'Ticket is ready to proceed to codebase analysis. After analysis detects gaps or divergences, open the approval gate at /approvals/:requestId to clear decisions before implementation.'
                : 'Resolve critical gaps before proceeding to codebase analysis.'}
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}
