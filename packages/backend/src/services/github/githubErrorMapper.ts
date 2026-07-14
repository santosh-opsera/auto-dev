import { AppError } from '../../utils/errors.js';

function looksLikeRateLimit(body?: string): boolean {
  return Boolean(body && /rate.?limit|secondary rate limit/i.test(body));
}

function resetActionHint(resetAtMs?: number): string {
  if (!resetAtMs || resetAtMs <= 0) {
    return 'Wait for the rate limit window to reset and retry.';
  }

  const resetAt = new Date(resetAtMs);
  const minutes = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 60_000));
  return `Rate limit resets around ${resetAt.toISOString()} (about ${String(minutes)} minute${minutes === 1 ? '' : 's'}). Retry after the window opens.`;
}

export function mapGitHubApiError(
  status: number,
  body?: string,
  options?: { resetAtMs?: number },
): AppError {
  if (status === 401) {
    return new AppError(
      'GitHubUnauthorized',
      'GitHub rejected the access token.',
      401,
      'Reconnect your GitHub account and retry.',
    );
  }

  if (status === 429 || (status === 403 && looksLikeRateLimit(body))) {
    return new AppError(
      'GitHubRateLimited',
      'GitHub API rate limit exceeded.',
      status,
      resetActionHint(options?.resetAtMs),
    );
  }

  if (status === 403) {
    return new AppError(
      'GitHubForbidden',
      'GitHub denied access to this repository.',
      403,
      'Verify repository permissions and OAuth scopes, then retry.',
    );
  }

  if (status === 404) {
    return new AppError(
      'GitHubNotFound',
      'The requested GitHub resource was not found.',
      404,
      'Check the owner, repository, and file path, then retry.',
    );
  }

  if (status === 422) {
    return new AppError(
      'GitHubValidationFailed',
      body
        ? `GitHub rejected the request: ${body}`
        : 'GitHub rejected the request due to a validation error.',
      422,
      'Confirm the head branch exists, differs from the base branch, and that a pull request does not already exist for this branch.',
    );
  }

  return new AppError(
    'GitHubApiError',
    `GitHub API request failed with status ${String(status)}${body ? `: ${body}` : ''}.`,
    status >= 500 ? 502 : status,
    'Retry the request or check GitHub status.',
  );
}
