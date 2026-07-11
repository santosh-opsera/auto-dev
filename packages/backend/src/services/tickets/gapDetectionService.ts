import type { GapItem, TicketIntent } from '@autodev/shared-types';
import type { NormalizedTicket } from '@autodev/shared-types';

const MIN_DESCRIPTION_LENGTH = 50;

export function detectTicketGaps(ticket: NormalizedTicket, intent: TicketIntent): GapItem[] {
  const gaps: GapItem[] = [];

  if (intent.acceptanceCriteria.length === 0) {
    gaps.push({
      field: 'acceptanceCriteria',
      severity: 'critical',
      description: 'No acceptance criteria were found in the ticket.',
      suggestedAction: 'Add explicit acceptance criteria before proceeding to codebase analysis.',
    });
  }

  if (ticket.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    gaps.push({
      field: 'description',
      severity: 'warning',
      description: 'Description is shorter than 50 characters and may be too vague.',
      suggestedAction: 'Expand the description with implementation context and edge cases.',
    });
  }

  if (
    ticket.issueType?.toLowerCase() === 'story' &&
    ticket.linkedIssues.length === 0
  ) {
    gaps.push({
      field: 'linkedIssues',
      severity: 'warning',
      description: 'Story ticket has no linked issues for dependency context.',
      suggestedAction: 'Link related epics, tasks, or blocking issues in Jira.',
    });
  }

  return gaps;
}

export function hasCriticalGaps(gaps: GapItem[]): boolean {
  return gaps.some((gap) => gap.severity === 'critical');
}

export function canProceedToAnalysis(gaps: GapItem[]): boolean {
  return !hasCriticalGaps(gaps);
}
