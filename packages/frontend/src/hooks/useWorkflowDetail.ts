import { useCallback, useEffect, useState } from 'react';
import type { DomainEvent, WorkflowResponse } from '@autodev/shared-types';
import {
  cancelWorkflow,
  fetchWorkflow,
  pauseWorkflow,
  resumeWorkflow,
} from '../api/workflows';
import { ApiError } from '../api/client';

export type WorkflowDetailPhase = 'idle' | 'loading' | 'ready' | 'error';

export interface WorkflowDetailState {
  phase: WorkflowDetailPhase;
  workflow: WorkflowResponse | null;
  error: string | null;
  liveMessage: string | null;
  isActing: boolean;
}

const initialState: WorkflowDetailState = {
  phase: 'idle',
  workflow: null,
  error: null,
  liveMessage: null,
  isActing: false,
};

export function useWorkflowDetail(workflowId: string | undefined) {
  const [state, setState] = useState<WorkflowDetailState>(initialState);

  const loadData = useCallback(async (id: string): Promise<void> => {
    setState((previous) => ({
      ...previous,
      phase: 'loading',
      error: null,
    }));

    try {
      const workflow = await fetchWorkflow(id);
      setState((previous) => ({
        ...previous,
        phase: 'ready',
        workflow,
        error: null,
      }));
    } catch (loadError) {
      const message =
        loadError instanceof ApiError
          ? [loadError.message, loadError.suggestedAction].filter(Boolean).join(' ')
          : loadError instanceof Error
            ? loadError.message
            : 'Failed to load workflow.';

      setState((previous) => ({
        ...previous,
        phase: 'error',
        error: message,
        workflow: null,
      }));
    }
  }, []);

  useEffect(() => {
    if (!workflowId?.trim()) {
      setState(initialState);
      return;
    }

    void loadData(workflowId.trim());
  }, [loadData, workflowId]);

  const runAction = useCallback(
    async (action: 'pause' | 'resume' | 'cancel'): Promise<boolean> => {
      if (!workflowId?.trim()) {
        return false;
      }

      setState((previous) => ({
        ...previous,
        isActing: true,
        error: null,
      }));

      try {
        let updated: WorkflowResponse;
        if (action === 'pause') {
          updated = await pauseWorkflow(workflowId.trim());
        } else if (action === 'resume') {
          updated = await resumeWorkflow(workflowId.trim());
        } else {
          updated = await cancelWorkflow(workflowId.trim());
        }

        const actionLabels = { pause: 'paused', resume: 'resumed', cancel: 'cancelled' } as const;

        setState((previous) => ({
          ...previous,
          isActing: false,
          phase: 'ready',
          workflow: updated,
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
          isActing: false,
          error: message,
        }));
        return false;
      }
    },
    [workflowId],
  );

  const handleSseEvent = useCallback(
    (event: DomainEvent) => {
      if (!workflowId?.trim()) {
        return;
      }

      if (event.type !== 'WORKFLOW_TRANSITIONED' && event.type !== 'WORKFLOW_FAILED') {
        return;
      }

      const messages: Record<string, string> = {
        WORKFLOW_TRANSITIONED: 'Workflow state updated.',
        WORKFLOW_FAILED: 'Workflow failed.',
      };

      setState((previous) => {
        const eventWorkflowId = event.payload.workflowId;
        const current = previous.workflow;
        const matchesCurrent =
          !current ||
          eventWorkflowId === workflowId.trim() ||
          eventWorkflowId === current.workflowId ||
          eventWorkflowId === current.id;

        if (!matchesCurrent) {
          return previous;
        }

        return {
          ...previous,
          liveMessage: messages[event.type] ?? 'Workflow status updated.',
        };
      });

      void loadData(workflowId.trim());
    },
    [loadData, workflowId],
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!workflowId?.trim()) {
      return;
    }
    await loadData(workflowId.trim());
  }, [loadData, workflowId]);

  return {
    ...state,
    pause: () => runAction('pause'),
    resume: () => runAction('resume'),
    cancel: () => runAction('cancel'),
    handleSseEvent,
    refresh,
  };
}
