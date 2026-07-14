import { Link } from 'react-router-dom';
import { getGitHubReposConnectUrl } from '../api/auth';
import { useRepositories } from '../hooks/useRepositories';
import { useAuthStore } from '../store/authStore';

export function RepositoriesPage() {
  const user = useAuthStore((state) => state.user);
  const githubReposReady = user?.integrations?.githubRepos ?? false;
  const needsGitHubConnect = user !== null && !githubReposReady;
  const hasGitHubProvider = user?.connectedProviders.includes('github') === true;

  const {
    available,
    connected,
    loading,
    error,
    errorCode,
    rateLimitWarning,
    connectingKey,
    analyzingKey,
    analysisResults,
    connectedKeys,
    refresh,
    connect,
    analyze,
  } = useRepositories({ fetchAvailable: githubReposReady });

  const isRateLimitError = errorCode === 'GitHubRateLimited';

  return (
    <main className="repositories-page">
      <header className="dashboard-header">
        <div>
          <h1>Repository connections</h1>
          <p>Connect GitHub repositories before running codebase analysis or divergence detection.</p>
        </div>
        <nav aria-label="Repository page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      {needsGitHubConnect ? (
        <section className="profile-card jira-connect-banner" role="status">
          <h2>GitHub repository access required</h2>
          <p>
            {hasGitHubProvider
              ? 'Your GitHub account is linked, but repository permissions may be missing or outdated. Reconnect to include organization repositories.'
              : 'Atlassian sign-in does not include GitHub repository access. Link GitHub and grant repository permissions to continue.'}
          </p>
          <a href={getGitHubReposConnectUrl()} className="primary-link">
            Connect GitHub repository access
          </a>
        </section>
      ) : null}

      {rateLimitWarning && !needsGitHubConnect ? (
        <section className="profile-card rate-limit-warning" role="status" aria-live="polite">
          <h2>GitHub rate limit warning</h2>
          <p>{rateLimitWarning}</p>
        </section>
      ) : null}

      {error && !needsGitHubConnect ? (
        <section className="profile-card" role="alert">
          <h2>{isRateLimitError ? 'GitHub rate limit reached' : 'Unable to load repositories'}</h2>
          <p className="page-error">{error}</p>
          <button type="button" className="secondary-button" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      ) : null}

      <section className="profile-card" aria-labelledby="connected-heading">
        <h2 id="connected-heading">Connected repositories</h2>
        {loading ? <p>Loading connected repositories…</p> : null}
        {!loading && connected.length === 0 ? (
          <p>
            {needsGitHubConnect
              ? 'Connect GitHub repository access above to browse and connect repositories.'
              : 'No repositories connected yet. Choose repositories from GitHub below.'}
          </p>
        ) : null}
        {!loading && connected.length > 0 ? (
          <ul className="repository-list">
            {connected.map((connection) => {
              const key = `${connection.owner}/${connection.repo}`;
              const result = analysisResults[key];

              return (
                <li key={connection.id} className="repository-list-item">
                  <div>
                    <strong>{connection.fullName}</strong>
                    <p className="field-hint">Default branch: {connection.defaultBranch}</p>
                    {result ? (
                      <p className="field-hint" role="status">
                        Analysis {result.cacheHit ? 'cache hit' : 'completed'} —{' '}
                        {result.context.designPatterns.length} patterns,{' '}
                        {result.context.namingConventions.length} naming conventions
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={analyzingKey === key}
                    onClick={() => void analyze(connection)}
                  >
                    {analyzingKey === key ? 'Analyzing…' : 'Analyze codebase'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {githubReposReady ? (
        <section className="profile-card" aria-labelledby="available-heading">
          <h2 id="available-heading">Available from GitHub</h2>
          {loading ? <p>Loading GitHub repositories…</p> : null}
          {!loading && available.length === 0 && !error ? (
            <p>No repositories returned from GitHub for this account.</p>
          ) : null}
          {!loading && available.length > 0 ? (
            <ul className="repository-list">
              {available.map((repository) => {
                const key = `${repository.owner}/${repository.name}`;
                const isConnected = connectedKeys.has(key);

                return (
                  <li key={repository.id} className="repository-list-item">
                    <div>
                      <strong>{repository.fullName}</strong>
                      <p className="field-hint">
                        {repository.private ? 'Private' : 'Public'} · branch {repository.defaultBranch}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={isConnected ? 'secondary-button' : 'primary-button'}
                      disabled={isConnected || connectingKey === key}
                      onClick={() => void connect(repository)}
                    >
                      {isConnected ? 'Connected' : connectingKey === key ? 'Connecting…' : 'Connect'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
