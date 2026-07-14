import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { DomainEvent } from '@autodev/shared-types';
import { WorkflowList } from '../components/workflows/WorkflowList';
import { useSSESubscription } from '../hooks/useSSESubscription';
import { useWorkflows } from '../hooks/useWorkflows';
import { WORKFLOW_FILTER_OPTIONS } from '../utils/workflowHelpers';

export function WorkflowsPage() {
  const {
    phase,
    error,
    liveMessage,
    filter,
    filteredWorkflows,
    actionWorkflowId,
    setFilter,
    pause,
    resume,
    cancel,
    handleSseEvent,
    refresh,
  } = useWorkflows();

  const onSseEvent = useCallback(
    (event: DomainEvent) => {
      handleSseEvent(event);
    },
    [handleSseEvent],
  );

  useSSESubscription(onSseEvent);

  return (
    <main className="workflows-page">
      <header className="dashboard-header">
        <div>
          <h1>Workflows</h1>
          <p>Monitor pipeline progress, pause or resume work, and cancel stuck workflows.</p>
        </div>
        <nav aria-label="Workflows page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      <section className="profile-card workflow-filters" aria-labelledby="workflow-filter-heading">
        <h2 id="workflow-filter-heading">Filter by state</h2>
        <div className="workflow-filter-buttons" role="group" aria-label="Workflow state filters">
          {WORKFLOW_FILTER_OPTIONS.map((option) => {
            const selected = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={selected ? 'primary-button' : 'secondary-button'}
                aria-pressed={selected}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {phase === 'loading' || phase === 'idle' ? (
        <section className="profile-card" role="status" aria-live="polite">
          <p>Loading workflows…</p>
        </section>
      ) : null}

      {phase === 'error' && error ? (
        <section className="profile-card ticket-error-state" role="alert">
          <h2>Unable to load workflows</h2>
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void refresh()}>
            Retry
          </button>
        </section>
      ) : null}

      {phase === 'ready' ? (
        <section className="profile-card" aria-labelledby="workflow-list-heading">
          <h2 id="workflow-list-heading">Workflow list</h2>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <WorkflowList
            workflows={filteredWorkflows}
            actionWorkflowId={actionWorkflowId}
            onPause={pause}
            onResume={resume}
            onCancel={cancel}
          />
        </section>
      ) : null}
    </main>
  );
}
