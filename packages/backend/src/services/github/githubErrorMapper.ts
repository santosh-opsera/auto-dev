import { AppError } from '../../utils/errors.js';

export function mapGitHubApiError(status: number, body?: string): AppError {
  if (status === 401) {
    return new AppError(
      'GitHubUnauthorized',
      'GitHub rejected the access token.',
      401,
      'Reconnect your GitHub account and retry.',
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

  if (status === 429) {
    return new AppError(
      'GitHubRateLimited',
      'GitHub API rate limit exceeded.',
      429,
      'Wait for the rate limit window to reset and retry.',
    );
  }

  return new AppError(
    'GitHubApiError',
    `GitHub API request failed with status ${String(status)}${body ? `: ${body}` : ''}.`,
    status >= 500 ? 502 : status,
    'Retry the request or check GitHub status.',
  );
}
