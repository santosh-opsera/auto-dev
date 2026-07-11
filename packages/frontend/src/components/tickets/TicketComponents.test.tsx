import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketGapList } from './TicketGapList';
import { TicketIntentPanel } from './TicketIntentPanel';
import { TicketKeyForm } from './TicketKeyForm';
import { TicketParsingSkeleton } from './TicketParsingSkeleton';
import { mockTicketParseWithCriticalGaps, mockTicketParseSuccess } from '../../fixtures/tickets';

afterEach(() => {
  cleanup();
});

describe('TicketKeyForm', () => {
  it('validates ticket key before submit', () => {
    const onSubmit = vi.fn();

    render(<TicketKeyForm onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText('Ticket key'), { target: { value: 'bad key!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load and parse ticket' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('submits a valid ticket key', () => {
    const onSubmit = vi.fn();

    render(<TicketKeyForm onSubmit={onSubmit} isSubmitting={false} />);

    fireEvent.change(screen.getByLabelText('Ticket key'), { target: { value: 'OPL-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load and parse ticket' }));

    expect(onSubmit).toHaveBeenCalledWith('OPL-1234');
  });
});

describe('TicketParsingSkeleton', () => {
  it('shows progress message while parsing', () => {
    render(
      <TicketParsingSkeleton
        ticketKey="OPL-1234"
        progressMessage="Parsing ticket and detecting gaps…"
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Parsing ticket and detecting gaps…')).toBeInTheDocument();
  });
});

describe('TicketIntentPanel', () => {
  it('renders parsed intent fields', () => {
    render(<TicketIntentPanel intent={mockTicketParseSuccess.intent} />);

    expect(screen.getByText('OPL-1234')).toBeInTheDocument();
    expect(screen.getByText('Add OAuth support')).toBeInTheDocument();
    expect(screen.getByText('User can sign in with GitHub OAuth')).toBeInTheDocument();
  });
});

describe('TicketGapList', () => {
  it('renders critical and warning gap cards', () => {
    render(<TicketGapList gaps={mockTicketParseWithCriticalGaps.gaps} />);

    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('acceptanceCriteria')).toBeInTheDocument();
  });

  it('shows success message when no gaps remain', () => {
    render(<TicketGapList gaps={[]} />);

    expect(screen.getByText(/No gaps detected/)).toBeInTheDocument();
  });

  it('calls onResolveGap when criteria are applied', () => {
    const onResolveGap = vi.fn();

    render(
      <TicketGapList gaps={mockTicketParseWithCriticalGaps.gaps} onResolveGap={onResolveGap} />,
    );

    fireEvent.change(screen.getByLabelText('Add acceptance criteria (one per line)'), {
      target: { value: 'User can login' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply criteria' }));

    expect(onResolveGap).toHaveBeenCalled();
  });
});
