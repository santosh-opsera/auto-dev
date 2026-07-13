import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DomainEvent, WorkflowResponse } from '@autodev/shared-types';
import { fetchWorkflows, pauseWorkflow, resumeWorkflow, cancelWorkflow } from '../api/workflows';
import { ApiError } from '../api/client';
import {
  filterWorkflows,
  type WorkflowFilterCategory,
} from '../utils/workflowHelpers';

export type WorkflowsPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface WorkflowsState {
  phase: WorkflowsPhase;
  workflows: WorkflowResponse[];
  filter: WorkflowFilterCategory;
  error: string | null;
  liveMessage: string | null;
  actionWorkflowId: string | null;
}

const initialState: WorkflowsState = {
  phase: 'idle',
  workflows: [],
  filter: 'all',
  error: null,
  liveMessage: null,
  actionWorkflowId: null,
};

export function useWorkflows() {
  const [state, setState] = useState<WorkflowsState>(initialState);

  const loadData = useCallback(async (): Promise<void> => {
    setState((previous) => ({
      ...previous,
      phase: 'loading',
      error: null,
    }));

    try {
      const response = await fetchWorkflows();
      setState((previous) => ({
        ...previous,
        phase: 'ready',
        workflows: response.workflows,
        error: null,
      }));
    } catch (loadError) {
      const message =
        loadError instanceof ApiError
          ? [loadError.message, loadError.suggestedAction].filter(Boolean).join(' ')
          : loadError instanceof Error
            ? loadError.message
            : 'Failed to load workflows.';

      setState((previous) => ({
        ...previous,
        phase: 'error',
        error: message,
        workflows: [],
      }));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setFilter = useCallback((filter: WorkflowFilterCategory): void => {
    setState((previous) => ({
      ...previous,
      filter,
      liveMessage: `Showing ${filter} workflows.`,
    }));
  }, []);

  const runAction = useCallback(
    async (
      workflowId: string,
      action: 'pause' | 'resume' | 'cancel',
    ): Promise<boolean> => {
      setState((previous) => ({
        ...previous,
        actionWorkflowId: workflowId,
        error: null,
      }));

      try {
        let updated: WorkflowResponse;
        if (action === 'pause') {
          updated = await pauseWorkflow(workflowId);
        } else if (action === 'resume') {
          updated = await resumeWorkflow(workflowId);
        } else {
          updated = await cancelWorkflow(workflowId);
        }

        const actionLabels = { pause: 'paused', resume: 'resumed', cancel: 'cancelled' } as const;

        setState((previous) => ({
          ...previous,
          actionWorkflowId: null,
          workflows: previous.workflows.map((workflow) =>
            workflow.id === updated.id || workflow.workflowId === updated.workflowId
              ? updated
              : workflow,
          ),
          liveMessage: `Workflow ${updated.ticketKey} ${actionLabels[action]}.`,
        }));
        return true;
      } catch (actionError) {
        const message =
          actionError instanceof ApiError
            ? [actionError.message, actionError.suggestedAction].filter(Boolean).join(' ')
            : actionError instanceof Error
              ? actionError.message
              : `Failed to ${action} workflow.`;

        setState((previous) => ({
          ...previous,
          actionWorkflowId: null,
          error: message,
        }));
        return false;
      }
    },
    [],
  );

  const handleSseEvent = useCallback(
    (event: DomainEvent) => {
      if (event.type !== 'WORKFLOW_TRANSITIONED' && event.type !== 'WORKFLOW_FAILED') {
        return;
      }

      const messages: Record<string, string> = {
        WORKFLOW_TRANSITIONED: `Workflow ${event.payload.workflowId} moved to ${
          'newState' in event.payload ? event.payload.newState : 'a new state'
        }.`,
        WORKFLOW_FAILED: `Workflow ${event.payload.workflowId} failed.`,
      };

      setState((previous) => ({
        ...previous,
        liveMessage: messages[event.type] ?? 'Workflow status updated.',
      }));

      void loadData();
    },
    [loadData],
  );

  const filteredWorkflows = useMemo(
    () => filterWorkflows(state.workflows, state.filter),
    [state.workflows, state.filter],
  );

  return {
    ...state,
    filteredWorkflows,
    setFilter,
    pause: (workflowId: string) => runAction(workflowId, 'pause'),
    resume: (workflowId: string) => runAction(workflowId, 'resume'),
    cancel: (workflowId: string) => runAction(workflowId, 'cancel'),
    handleSseEvent,
    refresh: loadData,
  };
}
