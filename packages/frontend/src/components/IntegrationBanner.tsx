import { useEffect, useState } from 'react';
import type { IntegrationsStatusResponse } from '@autodev/shared-types';
import {
  fetchIntegrationsStatus,
  getGitHubReposConnectUrl,
  getJiraConnectUrl,
} from '../api/integrations';

const DISMISS_STORAGE_KEY = 'autodev.integrationBanner.dismissedFingerprint';

function statusFingerprint(status: IntegrationsStatusResponse): string {
  return [status.github.connectionState, status.jira.connectionState].join('|');
}

function readDismissedFingerprint(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedFingerprint(fingerprint: string): void {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, fingerprint);
  } catch {
    // sessionStorage may be unavailable (private mode); dismiss still works in-memory.
  }
}

/**
 * Surfaces GitHub/Jira connection problems in the authenticated app shell.
 * Dismiss persists for the browser session until status changes.
 */
export function IntegrationBanner() {
  const [status, setStatus] = useState<IntegrationsStatusResponse | null>(null);
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(() =>
    readDismissedFingerprint(),
  );

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const response = await fetchIntegrationsStatus();
        if (active) {
          setStatus(response);
        }
      } catch {
        if (active) {
          setStatus(null);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (!status) {
    return null;
  }

  const fingerprint = statusFingerprint(status);
  const githubIssue = status.github.connectionState === 'disconnected';
  const jiraExpired = status.jira.connectionState === 'expired';
  const jiraDisconnected = status.jira.connectionState === 'disconnected';
  const hasIssue = githubIssue || jiraExpired || jiraDisconnected;

  if (!hasIssue) {
    return null;
  }

  if (dismissedFingerprint === fingerprint) {
    return null;
  }

  const handleDismiss = (): void => {
    writeDismissedFingerprint(fingerprint);
    setDismissedFingerprint(fingerprint);
  };

  return (
    <aside className="integration-banner" role="status" aria-live="polite">
      <div className="integration-banner-body">
        {githubIssue ? (
          <p>
            GitHub not connected.{' '}
            <a href={getGitHubReposConnectUrl()} className="text-link">
              Connect GitHub repositories
            </a>
          </p>
        ) : null}
        {jiraExpired ? (
          <p>
            Jira connection expired — Reconnect.{' '}
            <a href={getJiraConnectUrl()} className="text-link">
              Reconnect Jira
            </a>
          </p>
        ) : null}
        {jiraDisconnected ? (
          <p>
            Jira not connected.{' '}
            <a href={getJiraConnectUrl()} className="text-link">
              Connect Jira
            </a>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="integration-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss integration banner"
      >
        Dismiss
      </button>
    </aside>
  );
}
