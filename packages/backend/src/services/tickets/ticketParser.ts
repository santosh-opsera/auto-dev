import type { NormalizedTicket } from '@autodev/shared-types';
import type { TicketIntent } from '@autodev/shared-types';

export function parseTicketIntent(ticket: NormalizedTicket): TicketIntent {
  return {
    ticketKey: ticket.ticketKey,
    problemStatement: ticket.summary,
    proposedApproach: ticket.description,
    acceptanceCriteria: [...ticket.acceptanceCriteria],
    affectedComponents: ticket.labels.filter((label) => !label.startsWith('constraint:')),
    dependencies: ticket.linkedIssues.map((issue) => issue.key),
    constraints: ticket.labels
      .filter((label) => label.startsWith('constraint:'))
      .map((label) => label.replace(/^constraint:/, '')),
    metadata: {
      sourceSummary: ticket.summary,
      labels: ticket.labels,
      sprintContext: ticket.sprintContext,
      issueType: ticket.issueType,
      parsedAt: new Date().toISOString(),
    },
  };
}
