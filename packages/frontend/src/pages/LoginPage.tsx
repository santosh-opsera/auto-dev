import { getOAuthStartUrl } from '../api/auth';

export function LoginPage() {
  const startOAuth = (provider: 'github' | 'atlassian'): void => {
    window.location.assign(getOAuthStartUrl(provider));
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="login-heading" className="auth-card">
        <h1 id="login-heading">Sign in to AutoDev</h1>
        <p>Connect your developer accounts to start automating SDLC workflows.</p>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-button github"
            aria-label="Continue with GitHub"
            onClick={() => startOAuth('github')}
          >
            Continue with GitHub
          </button>
          <button
            type="button"
            className="oauth-button atlassian"
            aria-label="Continue with Atlassian"
            onClick={() => startOAuth('atlassian')}
          >
            Continue with Atlassian
          </button>
        </div>
      </section>
    </main>
  );
}
