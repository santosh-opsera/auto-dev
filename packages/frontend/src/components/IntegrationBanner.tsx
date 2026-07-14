import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Minimal stub for WO-013. Full IntegrationBanner (health status, reconnect CTAs)
 * is delivered by WO-014 / WO-058.
 */
export function IntegrationBanner() {
  const user = useAuthStore((state) => state.user);
  const jiraConnected = user?.integrations?.jira ?? false;
  const githubReposReady = user?.integrations?.githubRepos ?? false;

  if (jiraConnected && githubReposReady) {
    return null;
  }

  const missing: string[] = [];
  if (!jiraConnected) {
    missing.push('Jira');
  }
  if (!githubReposReady) {
    missing.push('GitHub repositories');
  }

  return (
    <aside className="integration-banner" role="status" aria-live="polite">
      <p>
        Connect {missing.join(' and ')} to unlock ticket ingestion and repository analysis.{' '}
        <Link to="/integrations" className="text-link">
          Manage integrations
        </Link>
      </p>
    </aside>
  );
}
