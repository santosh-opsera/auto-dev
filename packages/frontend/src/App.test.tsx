import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the landing page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'AutoDev' })).toBeInTheDocument();
    expect(screen.getByText('SDLC developer automation')).toBeInTheDocument();
  });
});
