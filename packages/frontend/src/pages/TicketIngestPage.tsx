import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJiraConnectUrl } from '../api/auth';
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

interface TicketIngestPageProps {
  onLogoutComplete: () => void;
}

export function TicketIngestPage({ onLogoutComplete }: TicketIngestPageProps) {
  const {
    phase,
    ticketKey,
    ticket,
    error,
    progressMessage,
    displayIntent,
    displayGaps,
    canProceed,
    ingestTicket,
    retry,
    retryWithManualFallback,
    reset,
    handleSseProgress,
    resolveGap,
  } = useTicketIngestion();

  const [showManualForm, setShowManualForm] = useState(false);
  const user = useAuthStore((state) => state.user);
  const jiraConnected = user?.integrations?.jira ?? false;
  const needsJiraConnect =
    user?.connectedProviders.includes('atlassian') === true && !jiraConnected;

  useSessionHeartbeat(true);

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
    void ingestTicket(key, showManualForm);
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

      {needsJiraConnect ? (
        <section className="profile-card jira-connect-banner" role="status">
          <h2>Jira access required</h2>
          <p>
            Your Atlassian account is signed in, but Jira read permissions are not granted yet.
            Connect Jira before loading tickets.
          </p>
          <a href={getJiraConnectUrl()} className="primary-link">
            Connect Jira permissions
          </a>
        </section>
      ) : null}

      {phase === 'idle' || phase === 'error' ? <TicketEmptyState /> : null}

      <section className="ticket-search-panel profile-card">
        <TicketKeyForm onSubmit={handleSubmit} isSubmitting={isLoading} initialValue={ticketKey ?? ''} />
        <p>
          <button
            type="button"
            className="text-link"
            onClick={() => setShowManualForm((previous) => !previous)}
          >
            {showManualForm ? 'Use standard Forge fetch' : 'Enter ticket key manually (REST fallback)'}
          </button>
        </p>
        {showManualForm ? (
          <p className="field-hint" role="status">
            Manual mode uses Jira REST API directly when Forge bridge is unavailable.
          </p>
        ) : null}
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
          onRetry={() => void retry()}
          onManualFallback={() => void retryWithManualFallback()}
          onManualEntry={() => setShowManualForm(true)}
          onConnectJira={needsJiraConnect ? () => window.location.assign(getJiraConnectUrl()) : undefined}
        />
      ) : null}

      {phase === 'complete' && displayIntent ? (
        <>
          {ticket ? (
            <section className="profile-card ticket-source-badge">
              <p>
                Loaded from <strong>{ticket.source}</strong>
                {ticket.fallbackUsed ? ' (REST fallback used)' : null}
              </p>
            </section>
          ) : null}
          <TicketIntentPanel intent={displayIntent} />
          <TicketGapList gaps={displayGaps} onResolveGap={resolveGap} />
          <section className="profile-card">
            <p role="status">
              {canProceed
                ? 'Ticket is ready to proceed to codebase analysis.'
                : 'Resolve critical gaps before proceeding to codebase analysis.'}
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}
