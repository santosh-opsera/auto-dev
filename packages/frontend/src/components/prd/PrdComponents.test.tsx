import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  sampleApprovedPrd,
  sampleExpectedPrdResponse,
  samplePrdVersionTwo,
  samplePrdWithXssAttempt,
} from '../../fixtures/prd';
import { PrdApprovedBadge } from './PrdApprovedBadge';
import { PrdRejectForm } from './PrdRejectForm';
import { PrdSectionPanels } from './PrdSectionPanels';
import { PrdVersionHistory } from './PrdVersionHistory';

afterEach(() => {
  cleanup();
});

describe('PrdSectionPanels', () => {
  it('renders all PRD sections as preformatted panels', () => {
    render(
      <PrdSectionPanels
        sections={sampleExpectedPrdResponse.sections}
        isEditing={false}
        draftSections={null}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Problem statement' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solution outline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'User stories' })).toBeInTheDocument();
    expect(
      screen.getByText(sampleExpectedPrdResponse.sections.problemStatement),
    ).toBeInTheDocument();
  });

  it('renders XSS content as escaped text without executable markup', () => {
    const { container } = render(
      <PrdSectionPanels
        sections={samplePrdWithXssAttempt}
        isEditing={false}
        draftSections={null}
        onChange={() => undefined}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/Fix <script>alert\("xss"\)<\/script>/)).toBeInTheDocument();
  });

  it('supports inline editing state for a section', () => {
    const onChange = vi.fn();
    render(
      <PrdSectionPanels
        sections={sampleExpectedPrdResponse.sections}
        isEditing
        draftSections={sampleExpectedPrdResponse.sections}
        onChange={onChange}
      />,
    );

    const field = screen.getByLabelText('Edit Problem statement');
    fireEvent.change(field, { target: { value: 'Updated problem statement' } });
    expect(onChange).toHaveBeenCalledWith('problemStatement', 'Updated problem statement');
  });
});

describe('PrdApprovedBadge', () => {
  it('shows approver and timestamp', () => {
    render(
      <PrdApprovedBadge
        approvedBy={sampleApprovedPrd.approvedBy!}
        approvedAt={sampleApprovedPrd.approvedAt!}
      />,
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText(/Alex Developer/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Alex Developer'),
    );
  });
});

describe('PrdRejectForm', () => {
  it('requires a reason before calling onReject', async () => {
    const onReject = vi.fn();
    render(
      <PrdRejectForm isRejecting={false} onReject={onReject} onCancel={() => undefined} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/required/i);
  });

  it('submits rejection reason', async () => {
    const onReject = vi.fn().mockResolvedValue(true);
    render(
      <PrdRejectForm isRejecting={false} onReject={onReject} onCancel={() => undefined} />,
    );

    fireEvent.change(screen.getByLabelText('Rejection reason'), {
      target: { value: 'Needs clearer metrics' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));

    expect(onReject).toHaveBeenCalledWith('Needs clearer metrics');
  });
});

describe('PrdVersionHistory', () => {
  it('lists versions and shows section diff between selections', () => {
    const onCompareChange = vi.fn();
    render(
      <MemoryRouter>
        <PrdVersionHistory
          history={[samplePrdVersionTwo, sampleExpectedPrdResponse]}
          compareFromId={sampleExpectedPrdResponse.id}
          compareToId={samplePrdVersionTwo.id}
          onCompareChange={onCompareChange}
          onSelectVersion={() => undefined}
          activePrdId={samplePrdVersionTwo.id}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Version 1')).toBeInTheDocument();
    expect(screen.getByText('Version 2')).toBeInTheDocument();
    expect(screen.getByText(/section changed/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solution outline' })).toBeInTheDocument();
  });
});
