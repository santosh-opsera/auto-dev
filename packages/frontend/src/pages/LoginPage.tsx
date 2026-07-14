import { useEffect } from 'react';
import { getOAuthStartUrl, prepareLoginPage } from '../api/auth';

export function LoginPage() {
  useEffect(() => {
    void prepareLoginPage();
  }, []);

  const startGitHubOAuth = (): void => {
    window.location.assign(getOAuthStartUrl('github'));
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="login-heading" className="auth-card">
        <h1 id="login-heading">Sign in to AutoDev</h1>
        <p>Connect your GitHub account to start automating SDLC workflows.</p>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-button github"
            aria-label="Continue with GitHub"
            onClick={startGitHubOAuth}
          >
            Continue with GitHub
          </button>
        </div>
      </section>
    </main>
  );
}
