import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mockWorkflowList,
  sampleWorkflowCompleted,
  sampleWorkflowImplementing,
  sampleWorkflowTesting,
} from '../../fixtures/workflows';
import { WorkflowActions } from './WorkflowActions';
import { WorkflowList } from './WorkflowList';
import { WorkflowStateBadge } from './WorkflowStateBadge';
import { WorkflowTimeline } from './WorkflowTimeline';

afterEach(() => {
  cleanup();
});

describe('WorkflowStateBadge', () => {
  it('renders progressing badge with green tone', () => {
    render(<WorkflowStateBadge state="IMPLEMENTING" />);

    const badge = screen.getByLabelText('Workflow state: Implementing');
    expect(badge).toHaveAttribute('data-tone', 'progressing');
    expect(badge.className).toContain('workflow-state-badge--progressing');
  });

  it('renders awaiting badge with yellow tone for paused', () => {
    render(<WorkflowStateBadge state="PAUSED" />);

    const badge = screen.getByLabelText('Workflow state: Paused');
    expect(badge).toHaveAttribute('data-tone', 'awaiting');
  });

  it('renders failed and cancelled tones', () => {
    const { rerender } = render(<WorkflowStateBadge state="FAILED" />);
    expect(screen.getByLabelText('Workflow state: Failed')).toHaveAttribute('data-tone', 'failed');

    rerender(<WorkflowStateBadge state="CANCELLED" />);
    expect(screen.getByLabelText('Workflow state: Cancelled')).toHaveAttribute(
      'data-tone',
      'cancelled',
    );
  });
});

describe('WorkflowActions visibility', () => {
  it('shows Pause and Cancel for IMPLEMENTING', () => {
    render(
      <WorkflowActions
        workflowId="wf-1"
        ticketKey="OPL-1"
        state="IMPLEMENTING"
        onPause={() => true}
        onResume={() => true}
        onCancel={() => true}
      />,
    );

    expect(screen.getByRole('button', { name: /Pause workflow OPL-1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume workflow OPL-1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel workflow OPL-1/ })).toBeInTheDocument();
  });

  it('shows Pause for TESTING', () => {
    render(
      <WorkflowActions
        workflowId="wf-2"
        ticketKey="OPL-2"
        state="TESTING"
        onPause={() => true}
        onResume={() => true}
        onCancel={() => true}
      />,
    );

    expect(screen.getByRole('button', { name: /Pause workflow OPL-2/ })).toBeInTheDocument();
  });

  it('shows Resume for PAUSED', () => {
    render(
      <WorkflowActions
        workflowId="wf-3"
        ticketKey="OPL-3"
        state="PAUSED"
        onPause={() => true}
        onResume={() => true}
        onCancel={() => true}
      />,
    );

    expect(screen.queryByRole('button', { name: /Pause workflow OPL-3/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume workflow OPL-3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel workflow OPL-3/ })).toBeInTheDocument();
  });

  it('hides cancel for terminal PR_CREATED', () => {
    render(
      <WorkflowActions
        workflowId="wf-4"
        ticketKey="OPL-4"
        state="PR_CREATED"
        onPause={() => true}
        onResume={() => true}
        onCancel={() => true}
      />,
    );

    expect(screen.getByText('No actions available')).toBeInTheDocument();
  });

  it('requires confirmation before cancel', () => {
    const onCancel = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <WorkflowActions
        workflowId="wf-5"
        ticketKey="OPL-5"
        state="IMPLEMENTING"
        onPause={() => true}
        onResume={() => true}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel workflow OPL-5/ }));
    expect(onCancel).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Cancel workflow OPL-5/ }));
    expect(onCancel).toHaveBeenCalledWith('wf-5');
  });
});

describe('WorkflowList', () => {
  it('renders ticket, title, state, and actions columns', () => {
    render(
      <MemoryRouter>
        <WorkflowList
          workflows={[sampleWorkflowImplementing, sampleWorkflowCompleted]}
          actionWorkflowId={null}
          onPause={() => true}
          onResume={() => true}
          onCancel={() => true}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('columnheader', { name: 'Ticket' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'State' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last updated' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /OPL-7005/ })).toHaveAttribute(
      'href',
      '/workflows/wf-doc-005',
    );
    expect(screen.getByText('chunk-implementation')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow state: Implementing')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow state: PR created')).toBeInTheDocument();
  });

  it('renders empty filter message', () => {
    render(
      <MemoryRouter>
        <WorkflowList
          workflows={[]}
          actionWorkflowId={null}
          onPause={() => true}
          onResume={() => true}
          onCancel={() => true}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/No workflows match/)).toBeInTheDocument();
  });

  it('lists mock fixture workflows', () => {
    render(
      <MemoryRouter>
        <WorkflowList
          workflows={mockWorkflowList.workflows}
          actionWorkflowId={null}
          onPause={() => true}
          onResume={() => true}
          onCancel={() => true}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /OPL-7002/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /OPL-7006/ })).toBeInTheDocument();
  });
});

describe('WorkflowTimeline', () => {
  it('renders state history entries', () => {
    render(<WorkflowTimeline history={sampleWorkflowTesting.history} />);

    const list = screen.getByLabelText('Workflow state history');
    expect(within(list).getAllByText('Implementing').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Testing').length).toBeGreaterThan(0);
    expect(within(list).getByText('testing.started')).toBeInTheDocument();
  });
});
