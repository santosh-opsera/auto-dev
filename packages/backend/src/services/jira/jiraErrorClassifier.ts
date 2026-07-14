import { AppError } from '../../utils/errors.js';

export interface JiraHttpErrorBody {
  errorMessages?: string[];
  message?: string;
}

/**
 * Maps Jira / Atlassian HTTP failures to actionable AppError subtypes (WO-011).
 */
export function classifyJiraHttpError(
  status: number,
  body?: JiraHttpErrorBody | null,
): AppError {
  const detail =
    body?.errorMessages?.[0] ??
    body?.message ??
    undefined;

  if (status === 401) {
    return new AppError(
      'AtlassianTokenExpired',
      detail ?? 'Your Jira access token is expired or invalid.',
      401,
      'Your Jira access has expired. Re-authorize to continue.',
    );
  }

  if (status === 403) {
    return new AppError(
      'JiraPermissionDenied',
      detail ?? 'You do not have permission to access this Jira ticket.',
      403,
      'You do not have permission to access this ticket. Check your Jira project permissions.',
    );
  }

  if (status === 404) {
    return new AppError(
      'JiraTicketNotFound',
      detail ?? 'The requested Jira ticket was not found.',
      404,
      'Ticket not found. Verify the ticket key and try again.',
    );
  }

  if (status === 429) {
    return new AppError(
      'JiraRateLimited',
      detail ?? 'Jira rate limit reached.',
      429,
      'Jira rate limit reached. Wait a moment and retry.',
    );
  }

  if (status === 502 || status === 503) {
    return new AppError(
      'JiraNetworkError',
      detail ?? 'Unable to reach Jira.',
      502,
      'Unable to reach Jira. Check your network connection and retry.',
    );
  }

  return new AppError(
    'JiraTicketUnavailable',
    detail ?? `Jira request failed with status ${String(status)}.`,
    status >= 400 && status < 600 ? status : 502,
    'Retry the request after a short delay.',
  );
}
