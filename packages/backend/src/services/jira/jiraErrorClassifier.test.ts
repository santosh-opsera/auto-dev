import { describe, expect, it } from 'vitest';
import { mockJiraErrorBodies } from '../../fixtures/jiraErrors.js';
import { classifyJiraHttpError } from './jiraErrorClassifier.js';

describe('classifyJiraHttpError', () => {
  it('classifies 401 as AtlassianTokenExpired', () => {
    const error = classifyJiraHttpError(401, mockJiraErrorBodies.unauthorized);
    expect(error).toMatchObject({
      error: 'AtlassianTokenExpired',
      statusCode: 401,
      suggestedAction: 'Your Jira access has expired. Re-authorize to continue.',
    });
  });

  it('classifies 403 as JiraPermissionDenied', () => {
    const error = classifyJiraHttpError(403, mockJiraErrorBodies.forbidden);
    expect(error).toMatchObject({
      error: 'JiraPermissionDenied',
      statusCode: 403,
      suggestedAction:
        'You do not have permission to access this ticket. Check your Jira project permissions.',
    });
  });

  it('classifies 404 as JiraTicketNotFound', () => {
    const error = classifyJiraHttpError(404, mockJiraErrorBodies.notFound);
    expect(error).toMatchObject({
      error: 'JiraTicketNotFound',
      statusCode: 404,
      suggestedAction: 'Ticket not found. Verify the ticket key and try again.',
    });
  });

  it('classifies 429 as JiraRateLimited', () => {
    const error = classifyJiraHttpError(429, mockJiraErrorBodies.rateLimited);
    expect(error).toMatchObject({
      error: 'JiraRateLimited',
      statusCode: 429,
      suggestedAction: 'Jira rate limit reached. Wait a moment and retry.',
    });
  });

  it('classifies 502/503 as JiraNetworkError', () => {
    expect(classifyJiraHttpError(502, mockJiraErrorBodies.badGateway)).toMatchObject({
      error: 'JiraNetworkError',
      statusCode: 502,
    });
    expect(classifyJiraHttpError(503, mockJiraErrorBodies.unavailable)).toMatchObject({
      error: 'JiraNetworkError',
      statusCode: 502,
      suggestedAction: 'Unable to reach Jira. Check your network connection and retry.',
    });
  });
});
