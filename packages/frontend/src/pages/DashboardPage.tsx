import { Link } from 'react-router-dom';
import { logout } from '../api/auth';
import { useProtectedRouteOutlet } from '../components/ProtectedRoute';
import { useAuthStore } from '../store/authStore';

export function DashboardPage() {
  const { onLogoutComplete } = useProtectedRouteOutlet();
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } finally {
      clearAuth();
      onLogoutComplete();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Signed in as {user.displayName}</p>
        </div>
        <button type="button" aria-label="Log out of AutoDev" onClick={() => void handleLogout()}>
          Log out
        </button>
      </header>

      <section aria-labelledby="profile-heading" className="profile-card">
        <h2 id="profile-heading">Profile</h2>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Connected providers</dt>
            <dd>{user.connectedProviders.join(', ')}</dd>
          </div>
          {session ? (
            <div>
              <dt>Session remaining</dt>
              <dd>{Math.round(session.remainingMs / 60_000)} minutes</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="setup-heading" className="profile-card">
        <h2 id="setup-heading">Setup</h2>
        <p>Configure commit, branch, PR, and reviewer conventions before starting development.</p>
        <Link to="/conventions" className="primary-link">
          Open convention settings
        </Link>
      </section>

      <section aria-labelledby="integrations-heading" className="profile-card">
        <h2 id="integrations-heading">Integrations</h2>
        <p>Connect Jira and GitHub before ingesting tickets or analyzing repositories.</p>
        <Link to="/integrations" className="primary-link">
          Manage integrations
        </Link>
      </section>

      <section aria-labelledby="repositories-heading" className="profile-card">
        <h2 id="repositories-heading">Repositories</h2>
        <p>Connect GitHub repositories before running codebase analysis on your tickets.</p>
        <Link to="/repositories" className="primary-link">
          Manage repository connections
        </Link>
      </section>

      <section aria-labelledby="tickets-heading" className="profile-card">
        <h2 id="tickets-heading">Tickets</h2>
        <p>Ingest Jira tickets, review parsed intent, and resolve gaps before codebase analysis.</p>
        <Link to="/tickets" className="primary-link">
          Open ticket ingestion
        </Link>
      </section>

      <section aria-labelledby="approvals-heading" className="profile-card">
        <h2 id="approvals-heading">Approvals</h2>
        <p>
          Review gap and divergence decisions at{' '}
          <code>/approvals/:requestId</code> after an approval request is created.
        </p>
        <Link to="/approvals/approval-001" className="primary-link">
          Open sample approval review
        </Link>
      </section>

      <section aria-labelledby="workflows-heading" className="profile-card">
        <h2 id="workflows-heading">Workflows</h2>
        <p>Track active pipelines, review state history, and pause, resume, or cancel workflows.</p>
        <Link to="/workflows" className="primary-link">
          Open workflow dashboard
        </Link>
      </section>
    </main>
  );
}
