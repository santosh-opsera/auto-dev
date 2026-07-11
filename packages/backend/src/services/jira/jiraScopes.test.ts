import { describe, expect, it } from 'vitest';
import { userHasJiraScopes } from './jiraScopes.js';
import type { UserDocument } from '../../models/userModel.js';

describe('userHasJiraScopes', () => {
  it('returns false when Jira scopes are missing', () => {
    const user = {
      atlassian: {
        scopes: ['read:me', 'offline_access'],
      },
    } as UserDocument;

    expect(userHasJiraScopes(user)).toBe(false);
  });

  it('returns true when Jira read scopes are present', () => {
    const user = {
      atlassian: {
        scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
      },
    } as UserDocument;

    expect(userHasJiraScopes(user)).toBe(true);
  });
});
