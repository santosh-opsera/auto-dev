import { Link } from 'react-router-dom';

export function AiMarketplacePage() {
  return (
    <main className="ai-marketplace-page">
      <header className="dashboard-header">
        <div>
          <h1>AI Marketplace</h1>
          <p>Curated AI models and tools to supercharge your development workflows.</p>
        </div>
        <nav aria-label="AI Marketplace page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      <section className="ai-marketplace-coming-soon" aria-labelledby="ai-marketplace-heading">
        <span className="ai-marketplace-badge">Coming soon</span>
        <h2 id="ai-marketplace-heading">Coming Soon</h2>
        <p>
          We&apos;re curating a marketplace of AI models and tools you can plug straight into
          your workflows. Check back soon to browse and connect the integrations that fit
          your team.
        </p>
        <Link to="/dashboard" className="primary-button ai-marketplace-back-button">
          Back to Dashboard
        </Link>
      </section>
    </main>
  );
}
