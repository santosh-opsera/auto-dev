import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AiMarketplacePage } from './AiMarketplacePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ai-marketplace']}>
      <AiMarketplacePage />
    </MemoryRouter>,
  );
}

describe('AiMarketplacePage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the AI Marketplace heading and coming soon state', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'AI Marketplace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Coming Soon' })).toBeInTheDocument();
  });

  it('describes upcoming AI models and tools', () => {
    renderPage();

    expect(screen.getByText(/marketplace of ai models and tools/i)).toBeInTheDocument();
  });

  it('offers a Back to Dashboard button linking to the dashboard', () => {
    renderPage();

    const section = screen.getByRole('region', { name: 'Coming Soon' });
    const backButton = within(section).getByRole('link', { name: 'Back to Dashboard' });

    expect(backButton).toHaveAttribute('href', '/dashboard');
  });
});
