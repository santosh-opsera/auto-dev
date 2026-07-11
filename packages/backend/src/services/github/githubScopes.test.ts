import { describe, expect, it } from 'vitest';
import { userHasGitHubAccount, userHasGitHubRepoScopes } from './githubScopes.js';
import type { UserDocument } from '../../models/userModel.js';

describe('githubScopes', () => {
  it('detects missing GitHub account', () => {
    expect(userHasGitHubAccount({ github: undefined } as UserDocument)).toBe(false);
    expect(userHasGitHubRepoScopes({ github: undefined } as UserDocument)).toBe(false);
  });

  it('detects GitHub account without repository scope', () => {
    const user = {
      github: {
        encryptedAccessToken: 'enc',
        scopes: ['read:user', 'user:email'],
      },
    } as UserDocument;

    expect(userHasGitHubAccount(user)).toBe(true);
    expect(userHasGitHubRepoScopes(user)).toBe(false);
  });

  it('detects GitHub repository scope', () => {
    const user = {
      github: {
        encryptedAccessToken: 'enc',
        scopes: ['read:user', 'user:email', 'repo'],
      },
    } as UserDocument;

    expect(userHasGitHubRepoScopes(user)).toBe(true);
  });
});
