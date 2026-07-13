import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent, WorkflowResponse } from '@autodev/shared-types';
import { sampleWorkflowFailedEvent, sampleWorkflowTransitionedEvent } from '@autodev/shared-types';
import * as workflowsApi from '../api/workflows';
import {
  mockWorkflowList,
  sampleWorkflowImplementing,
  sampleWorkflowPaused,
} from '../fixtures/workflows';
import { useWorkflows } from './useWorkflows';

describe('useWorkflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads workflows and applies filters', async () => {
    vi.spyOn(workflowsApi, 'fetchWorkflows').mockResolvedValue(mockWorkflowList);

    const { result } = renderHook(() => useWorkflows());

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    expect(result.current.workflows).toHaveLength(mockWorkflowList.workflows.length);

    act(() => {
      result.current.setFilter('paused');
    });

    expect(result.current.filteredWorkflows.every((workflow) => workflow.state === 'PAUSED')).toBe(
      true,
    );
  });

  it('pauses a workflow and updates list state', async () => {
    const pausedFromImplementing: WorkflowResponse = {
      ...sampleWorkflowImplementing,
      state: 'PAUSED',
      pausedFrom: 'IMPLEMENTING',
      availableTransitions: ['IMPLEMENTING', 'CANCELLED', 'FAILED'],
    };

    vi.spyOn(workflowsApi, 'fetchWorkflows').mockResolvedValue({
      workflows: [sampleWorkflowImplementing],
    });
    vi.spyOn(workflowsApi, 'pauseWorkflow').mockResolvedValue(pausedFromImplementing);

    const { result } = renderHook(() => useWorkflows());

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    await act(async () => {
      await result.current.pause(sampleWorkflowImplementing.id);
    });

    expect(workflowsApi.pauseWorkflow).toHaveBeenCalledWith(sampleWorkflowImplementing.id);
    expect(result.current.workflows[0]?.state).toBe('PAUSED');
  });

  it('refreshes on workflow SSE events', async () => {
    const fetchSpy = vi
      .spyOn(workflowsApi, 'fetchWorkflows')
      .mockResolvedValue({ workflows: [sampleWorkflowImplementing] });

    const { result } = renderHook(() => useWorkflows());

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    fetchSpy.mockResolvedValue({ workflows: [sampleWorkflowPaused] });

    await act(async () => {
      result.current.handleSseEvent(sampleWorkflowTransitionedEvent as DomainEvent);
    });

    await waitFor(() => {
      expect(result.current.liveMessage).toMatch(/moved to/);
    });

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);

    await act(async () => {
      result.current.handleSseEvent(sampleWorkflowFailedEvent as DomainEvent);
    });

    await waitFor(() => {
      expect(result.current.liveMessage).toMatch(/failed/i);
    });
  });
});
