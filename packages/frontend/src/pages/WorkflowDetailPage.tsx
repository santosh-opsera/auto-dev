import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DomainEvent } from '@autodev/shared-types';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { WorkflowActions } from '../components/workflows/WorkflowActions';
import { WorkflowStateBadge } from '../components/workflows/WorkflowStateBadge';
import { WorkflowTimeline } from '../components/workflows/WorkflowTimeline';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';
import { useWorkflowDetail } from '../hooks/useWorkflowDetail';
import {
  formatWorkflowState,
  formatWorkflowTimestamp,
  getWorkflowTitle,
} from '../utils/workflowHelpers';

interface WorkflowDetailPageProps {
  onLogoutComplete: () => void;
}

export function WorkflowDetailPage({ onLogoutComplete }: WorkflowDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const {
    phase,
    workflow,
    error,
    liveMessage,
    isActing,
    pause,
    resume,
    cancel,
    handleSseEvent,
    refresh,
  } = useWorkflowDetail(id);

  useSessionHeartbeat(true);

  const onSseEvent = useCallback(
    (event: DomainEvent) => {
      handleSseEvent(event);
    },
    [handleSseEvent],
  );

  useSSE({ enabled: Boolean(id), onEvent: onSseEvent });

  return (
    <main className="workflows-page">
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

      <header className="dashboard-header">
        <div>
          <h1>Workflow detail</h1>
          <p>State history, current step, and available control actions.</p>
        </div>
        <nav aria-label="Workflow detail navigation">
          <Link to="/workflows" className="text-link">
            Back to workflows
          </Link>
          {' · '}
          <Link to="/dashboard" className="text-link">
            Dashboard
          </Link>
        </nav>
      </header>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      {phase === 'loading' || phase === 'idle' ? (
        <section className="profile-card" role="status" aria-live="polite">
          <p>Loading workflow…</p>
        </section>
      ) : null}

      {phase === 'error' && error ? (
        <section className="profile-card ticket-error-state" role="alert">
          <h2>Unable to load workflow</h2>
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      ) : null}

      {phase === 'ready' && workflow ? (
        <>
          <section className="profile-card workflow-detail-meta" aria-labelledby="workflow-meta-heading">
            <h2 id="workflow-meta-heading">{workflow.ticketKey}</h2>
            <dl>
              <div>
                <dt>Title</dt>
                <dd>{getWorkflowTitle(workflow)}</dd>
              </div>
              <div>
                <dt>Current state</dt>
                <dd>
                  <WorkflowStateBadge state={workflow.state} />
                </dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  <time dateTime={workflow.updatedAt}>
                    {formatWorkflowTimestamp(workflow.updatedAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Workflow ID</dt>
                <dd>{workflow.workflowId}</dd>
              </div>
            </dl>
          </section>

          <section className="profile-card" aria-labelledby="current-step-heading">
            <h2 id="current-step-heading">Current step</h2>
            <p>
              <strong>{formatWorkflowState(workflow.state)}</strong>
              {workflow.progress?.phase ? ` — ${workflow.progress.phase}` : null}
            </p>
            {typeof workflow.progress?.percent === 'number' ? (
              <div className="workflow-progress">
                <div
                  className="workflow-progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={workflow.progress.percent}
                  aria-label="Workflow progress"
                >
                  <div
                    className="workflow-progress-fill"
                    style={{ width: `${workflow.progress.percent}%` }}
                  />
                </div>
                <p className="field-hint">{workflow.progress.percent}% complete</p>
              </div>
            ) : null}
            {workflow.progress?.chunkId ? (
              <p className="field-hint">Chunk: {workflow.progress.chunkId}</p>
            ) : null}
            {workflow.error ? (
              <div className="workflow-error-panel" role="alert">
                <h3>Failure details</h3>
                <p>{workflow.error.message}</p>
                {workflow.error.code ? <p>Code: {workflow.error.code}</p> : null}
              </div>
            ) : null}
            {workflow.pausedFrom ? (
              <p className="field-hint">Paused from: {formatWorkflowState(workflow.pausedFrom)}</p>
            ) : null}
          </section>

          <section className="profile-card" aria-labelledby="workflow-actions-heading">
            <h2 id="workflow-actions-heading">Available actions</h2>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <WorkflowActions
              workflowId={workflow.id || workflow.workflowId}
              ticketKey={workflow.ticketKey}
              state={workflow.state}
              isActing={isActing}
              onPause={() => pause()}
              onResume={() => resume()}
              onCancel={() => cancel()}
            />
            {workflow.availableTransitions.length > 0 ? (
              <p className="field-hint">
                Next transitions:{' '}
                {workflow.availableTransitions.map(formatWorkflowState).join(', ')}
              </p>
            ) : null}
          </section>

          <section className="profile-card" aria-labelledby="history-heading">
            <h2 id="history-heading">State history</h2>
            <WorkflowTimeline history={workflow.history} />
          </section>
        </>
      ) : null}
    </main>
  );
}
