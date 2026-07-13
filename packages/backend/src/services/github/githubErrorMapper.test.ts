import { describe, expect, it } from 'vitest';
import { mapGitHubApiError } from './githubErrorMapper.js';

describe('mapGitHubApiError', () => {
  it('maps common GitHub status codes', () => {
    expect(mapGitHubApiError(401).error).toBe('GitHubUnauthorized');
    expect(mapGitHubApiError(403).error).toBe('GitHubForbidden');
    expect(mapGitHubApiError(404).error).toBe('GitHubNotFound');
    expect(mapGitHubApiError(422).error).toBe('GitHubValidationFailed');
    expect(mapGitHubApiError(429).error).toBe('GitHubRateLimited');
  });
});
