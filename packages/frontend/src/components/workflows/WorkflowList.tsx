import { Link } from 'react-router-dom';
import type { WorkflowResponse } from '@autodev/shared-types';
import {
  formatWorkflowTimestamp,
  getWorkflowTitle,
} from '../../utils/workflowHelpers';
import { WorkflowActions } from './WorkflowActions';
import { WorkflowStateBadge } from './WorkflowStateBadge';

interface WorkflowListProps {
  workflows: WorkflowResponse[];
  actionWorkflowId: string | null;
  onPause: (workflowId: string) => void | boolean | Promise<boolean>;
  onResume: (workflowId: string) => void | boolean | Promise<boolean>;
  onCancel: (workflowId: string) => void | boolean | Promise<boolean>;
}

export function WorkflowList({
  workflows,
  actionWorkflowId,
  onPause,
  onResume,
  onCancel,
}: WorkflowListProps) {
  if (workflows.length === 0) {
    return (
      <p className="field-hint" role="status">
        No workflows match the selected filter.
      </p>
    );
  }

  return (
    <div className="workflow-table-wrap">
      <table className="workflow-table">
        <caption className="visually-hidden">Workflows</caption>
        <thead>
          <tr>
            <th scope="col">Ticket</th>
            <th scope="col">Title</th>
            <th scope="col">State</th>
            <th scope="col">Last updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((workflow) => {
            const detailId = workflow.id || workflow.workflowId;
            return (
              <tr key={detailId}>
                <td>
                  <Link
                    to={`/workflows/${encodeURIComponent(detailId)}`}
                    className="text-link"
                    aria-label={`Open workflow detail for ${workflow.ticketKey}`}
                  >
                    {workflow.ticketKey}
                  </Link>
                </td>
                <td>{getWorkflowTitle(workflow)}</td>
                <td>
                  <WorkflowStateBadge state={workflow.state} />
                </td>
                <td>
                  <time dateTime={workflow.updatedAt}>
                    {formatWorkflowTimestamp(workflow.updatedAt)}
                  </time>
                </td>
                <td>
                  <WorkflowActions
                    workflowId={detailId}
                    ticketKey={workflow.ticketKey}
                    state={workflow.state}
                    isActing={actionWorkflowId === detailId}
                    onPause={onPause}
                    onResume={onResume}
                    onCancel={onCancel}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
