import { logout } from '../api/auth';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useAuthStore } from '../store/authStore';

interface DashboardPageProps {
  onLogoutComplete: () => void;
}

export function DashboardPage({ onLogoutComplete }: DashboardPageProps) {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useSessionHeartbeat(true);

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
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

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
    </main>
  );
}
