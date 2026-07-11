import { Link } from 'react-router-dom';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { useRepositories } from '../hooks/useRepositories';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';

interface RepositoriesPageProps {
  onLogoutComplete: () => void;
}

export function RepositoriesPage({ onLogoutComplete }: RepositoriesPageProps) {
  const {
    available,
    connected,
    loading,
    error,
    connectingKey,
    analyzingKey,
    analysisResults,
    connectedKeys,
    refresh,
    connect,
    analyze,
  } = useRepositories();

  useSessionHeartbeat(true);
  useSSE({ enabled: true });

  return (
    <main className="repositories-page">
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

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

      {error ? (
        <section className="profile-card" role="alert">
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
          <p>No repositories connected yet. Choose repositories from GitHub below.</p>
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

      <section className="profile-card" aria-labelledby="available-heading">
        <h2 id="available-heading">Available from GitHub</h2>
        {loading ? <p>Loading GitHub repositories…</p> : null}
        {!loading && available.length === 0 ? (
          <p>No repositories returned from GitHub. Confirm GitHub is connected with repository access.</p>
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
    </main>
  );
}
