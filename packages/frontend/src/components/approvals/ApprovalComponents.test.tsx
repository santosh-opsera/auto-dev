import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sampleApprovalRequestMixed,
  sampleApprovalRequestPending,
} from '../../fixtures/approvals';
import { ApprovalDecisionPanel } from './ApprovalDecisionPanel';
import { ApprovalExpiryCountdown } from './ApprovalExpiryCountdown';
import { ApprovalProgressBar } from './ApprovalProgressBar';
import { DivergenceComparisonCard } from './DivergenceComparisonCard';
import { GapApprovalCard } from './GapApprovalCard';

afterEach(() => {
  cleanup();
});

describe('ApprovalProgressBar', () => {
  it('shows resolved/total progress', () => {
    render(<ApprovalProgressBar resolvedCount={1} totalCount={4} />);

    expect(screen.getByText('1 of 4 resolved')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });
});

describe('ApprovalExpiryCountdown', () => {
  it('shows countdown toward expiry', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    render(<ApprovalExpiryCountdown expiresAt={future} />);

    expect(screen.getByText(/Countdown toward 72-hour expiry/)).toBeInTheDocument();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('announces expired state', () => {
    render(<ApprovalExpiryCountdown expiresAt="2020-01-01T00:00:00.000Z" />);

    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  });
});

describe('DivergenceComparisonCard', () => {
  it('renders side-by-side ticket vs codebase comparison with recommendation', () => {
    const item = sampleApprovalRequestPending.items.find((entry) => entry.type === 'divergence')!;

    render(
      <ul>
        <DivergenceComparisonCard
          item={item}
          isResolving={false}
          onResolve={() => true}
        />
      </ul>,
    );

    expect(screen.getByText('Ticket approach')).toBeInTheDocument();
    expect(screen.getByText('Codebase convention')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(
      screen.getByText(item.divergence!.ticketApproach),
    ).toBeInTheDocument();
    expect(
      screen.getByText(item.divergence!.codebaseConvention),
    ).toBeInTheDocument();
    expect(screen.getAllByText(item.divergence!.recommendation).length).toBeGreaterThanOrEqual(1);
  });
});

describe('GapApprovalCard', () => {
  it('shows missing field, severity, and decision actions', () => {
    const item = sampleApprovalRequestPending.items.find((entry) => entry.type === 'gap')!;

    render(
      <ul>
        <GapApprovalCard item={item} isResolving={false} onResolve={() => true} />
      </ul>,
    );

    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('acceptanceCriteria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify' })).toBeInTheDocument();
  });
});

describe('ApprovalDecisionPanel', () => {
  it('transitions through action selection and submits approve', async () => {
    const onResolve = vi.fn().mockResolvedValue(true);
    const item = sampleApprovalRequestPending.items[0]!;

    render(<ApprovalDecisionPanel item={item} isResolving={false} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByLabelText(/Rationale/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Approve' }));

    expect(onResolve).toHaveBeenCalledWith({
      action: 'approve',
      rationale: '',
      modifiedValue: undefined,
    });
  });

  it('requires rationale for reject before calling onResolve', () => {
    const onResolve = vi.fn();
    const item = sampleApprovalRequestPending.items[0]!;

    render(<ApprovalDecisionPanel item={item} isResolving={false} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reject' }));

    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Rationale is required/);
  });

  it('requires modifiedValue for modify', () => {
    const onResolve = vi.fn();
    const item = sampleApprovalRequestPending.items[0]!;

    render(<ApprovalDecisionPanel item={item} isResolving={false} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
    fireEvent.change(screen.getByLabelText(/Rationale/), {
      target: { value: 'Need alternate text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Modify' }));

    expect(onResolve).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Modified value is required/);
  });

  it('shows resolved decision state when item is not pending', () => {
    const item = sampleApprovalRequestMixed.items.find((entry) => entry.status === 'approved')!;

    render(<ApprovalDecisionPanel item={item} isResolving={false} onResolve={() => true} />);

    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });
});
