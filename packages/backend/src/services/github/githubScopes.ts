import { GITHUB_REPO_SCOPES } from '../../auth/constants.js';
import type { UserDocument } from '../../models/userModel.js';

export function userHasGitHubAccount(user: UserDocument): boolean {
  return Boolean(user.github?.encryptedAccessToken);
}

export function userHasGitHubRepoScopes(user: UserDocument): boolean {
  const scopes = user.github?.scopes ?? [];
  return GITHUB_REPO_SCOPES.every((scope) => scopes.includes(scope));
}
