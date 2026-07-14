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

  it('maps 403 rate-limit messages to GitHubRateLimited with reset hint', () => {
    const resetAtMs = Date.parse('2026-07-14T12:30:00.000Z');
    const error = mapGitHubApiError(403, 'API rate limit exceeded', { resetAtMs });

    expect(error.error).toBe('GitHubRateLimited');
    expect(error.statusCode).toBe(403);
    expect(error.suggestedAction).toContain('2026-07-14T12:30:00.000Z');
  });
});
