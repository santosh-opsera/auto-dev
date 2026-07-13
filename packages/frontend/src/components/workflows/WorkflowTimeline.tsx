import type { WorkflowTransitionRecord } from '@autodev/shared-types';
import { useLocaleStore } from '../../store/localeStore';
import {
  formatWorkflowState,
  formatWorkflowTimestamp,
} from '../../utils/workflowHelpers';

interface WorkflowTimelineProps {
  history: WorkflowTransitionRecord[];
}

export function WorkflowTimeline({ history }: WorkflowTimelineProps) {
  const locale = useLocaleStore((state) => state.locale);

  if (history.length === 0) {
    return (
      <p className="field-hint" role="status">
        No state transitions yet.
      </p>
    );
  }

  const ordered = [...history].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return (
    <ol className="workflow-timeline" aria-label="Workflow state history">
      {ordered.map((entry, index) => (
        <li
          key={`${entry.timestamp}-${entry.newState}-${index}`}
          className="workflow-timeline-item"
        >
          <div className="workflow-timeline-marker" aria-hidden="true" />
          <div className="workflow-timeline-content">
            <p className="workflow-timeline-states">
              <span>{formatWorkflowState(entry.previousState)}</span>
              <span aria-hidden="true"> → </span>
              <span className="workflow-timeline-new-state">
                {formatWorkflowState(entry.newState)}
              </span>
            </p>
            <p className="workflow-timeline-meta">
              <time dateTime={entry.timestamp}>
                {formatWorkflowTimestamp(entry.timestamp, locale)}
              </time>
              {' · '}
              <span>{entry.trigger}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
