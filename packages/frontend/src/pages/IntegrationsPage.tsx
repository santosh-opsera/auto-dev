import { Link } from 'react-router-dom';
import { getGitHubReposConnectUrl, getJiraConnectUrl } from '../api/auth';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';
import { useAuthStore } from '../store/authStore';

interface IntegrationsPageProps {
  onLogoutComplete: () => void;
}

export function IntegrationsPage({ onLogoutComplete }: IntegrationsPageProps) {
  const user = useAuthStore((state) => state.user);
  const jiraConnected = user?.integrations?.jira ?? false;
  const githubReposReady = user?.integrations?.githubRepos ?? false;
  const hasAtlassianProvider = user?.connectedProviders.includes('atlassian') === true;
  const atlassianEmail = user?.integrations?.atlassianEmail;

  useSessionHeartbeat(true);
  useSSE({ enabled: true });

  return (
    <main className="integrations-page">
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

      <header className="dashboard-header">
        <div>
          <h1>Integrations</h1>
          <p>Connect Jira and GitHub so AutoDev can ingest tickets and analyze repositories.</p>
        </div>
        <nav aria-label="Integrations page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      <section className="profile-card" aria-labelledby="jira-integration-heading">
        <h2 id="jira-integration-heading">Jira</h2>
        {jiraConnected ? (
          <div role="status">
            <p>
              <strong>Status:</strong> Active
            </p>
            <p>
              <strong>Atlassian account:</strong> {atlassianEmail ?? user?.email ?? 'Connected'}
            </p>
          </div>
        ) : (
          <div className="jira-connect-banner" role="status">
            <p>
              {hasAtlassianProvider
                ? 'Your Atlassian account is linked, but Jira read permissions are not granted yet. Connect Jira to ingest tickets.'
                : 'GitHub sign-in does not include Jira access. Connect Jira to grant read permissions before ingesting tickets.'}
            </p>
            <a href={getJiraConnectUrl()} className="primary-link">
              Connect Jira
            </a>
          </div>
        )}
      </section>

      <section className="profile-card" aria-labelledby="github-integration-heading">
        <h2 id="github-integration-heading">GitHub repositories</h2>
        {githubReposReady ? (
          <p role="status">
            <strong>Status:</strong> Active — repository permissions granted.
          </p>
        ) : (
          <div role="status">
            <p>Connect GitHub repository access before analyzing codebases.</p>
            <a href={getGitHubReposConnectUrl()} className="primary-link">
              Connect GitHub repository access
            </a>
          </div>
        )}
        <p>
          <Link to="/repositories" className="text-link">
            Manage repository connections
          </Link>
        </p>
      </section>
    </main>
  );
}
