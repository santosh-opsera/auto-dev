import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as prdApi from '../api/prd';
import {
  sampleApprovedPrd,
  sampleExpectedPrdResponse,
  samplePrdVersionTwo,
} from '../fixtures/prd';
import { usePrdReview } from './usePrdReview';

describe('usePrdReview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads a PRD by id with version history', async () => {
    vi.spyOn(prdApi, 'fetchPrdById').mockResolvedValue(samplePrdVersionTwo);
    vi.spyOn(prdApi, 'fetchPrdVersionHistory').mockResolvedValue({
      prds: [samplePrdVersionTwo, sampleExpectedPrdResponse],
    });

    const { result } = renderHook(() => usePrdReview({ prdId: 'prd-002' }));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    expect(result.current.prd?.id).toBe('prd-002');
    expect(result.current.history).toHaveLength(2);
    expect(result.current.canApprove).toBe(true);
    expect(result.current.canEdit).toBe(true);
  });

  it('manages inline editing and saves a new version', async () => {
    vi.spyOn(prdApi, 'fetchPrdById').mockResolvedValue(sampleExpectedPrdResponse);
    vi.spyOn(prdApi, 'fetchPrdVersionHistory').mockResolvedValue({
      prds: [sampleExpectedPrdResponse],
    });
    vi.spyOn(prdApi, 'createPrdVersion').mockResolvedValue(samplePrdVersionTwo);

    const { result } = renderHook(() => usePrdReview({ prdId: 'prd-001' }));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    act(() => {
      result.current.startEditing();
    });
    expect(result.current.isEditing).toBe(true);

    act(() => {
      result.current.updateDraftSection('solutionOutline', 'Edited solution');
    });

    vi.spyOn(prdApi, 'fetchPrdVersionHistory').mockResolvedValue({
      prds: [samplePrdVersionTwo, sampleExpectedPrdResponse],
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.saveVersion();
    });

    expect(saved).toBe(true);
    expect(prdApi.createPrdVersion).toHaveBeenCalledWith('prd-001', {
      sections: expect.objectContaining({ solutionOutline: 'Edited solution' }),
      status: 'in_review',
    });
    expect(result.current.prd?.version).toBe(2);
    expect(result.current.isEditing).toBe(false);
  });

  it('approves and rejects with reason validation', async () => {
    vi.spyOn(prdApi, 'fetchPrdById').mockResolvedValue(sampleExpectedPrdResponse);
    vi.spyOn(prdApi, 'fetchPrdVersionHistory').mockResolvedValue({
      prds: [sampleExpectedPrdResponse],
    });
    vi.spyOn(prdApi, 'approvePrd').mockResolvedValue(sampleApprovedPrd);
    vi.spyOn(prdApi, 'rejectPrd').mockResolvedValue({
      ...sampleExpectedPrdResponse,
      status: 'rejected',
      rejectionReason: 'Too vague',
      rejectedBy: 'Alex Developer',
      rejectedAt: '2026-07-13T12:30:00.000Z',
    });

    const { result } = renderHook(() => usePrdReview({ prdId: 'prd-001' }));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    let rejectedWithoutReason = true;
    await act(async () => {
      rejectedWithoutReason = await result.current.reject('   ');
    });
    expect(rejectedWithoutReason).toBe(false);
    expect(prdApi.rejectPrd).not.toHaveBeenCalled();

    let rejected = false;
    await act(async () => {
      rejected = await result.current.reject('Too vague');
    });
    expect(rejected).toBe(true);
    expect(prdApi.rejectPrd).toHaveBeenCalledWith('prd-001', { reason: 'Too vague' });

    vi.spyOn(prdApi, 'fetchPrdById').mockResolvedValue({
      ...sampleExpectedPrdResponse,
      status: 'in_review',
    });

    const approvedHook = renderHook(() => usePrdReview({ prdId: 'prd-001' }));
    await waitFor(() => {
      expect(approvedHook.result.current.phase).toBe('ready');
    });

    let approved = false;
    await act(async () => {
      approved = await approvedHook.result.current.approve();
    });
    expect(approved).toBe(true);
    expect(prdApi.approvePrd).toHaveBeenCalledWith('prd-001');
  });
});
