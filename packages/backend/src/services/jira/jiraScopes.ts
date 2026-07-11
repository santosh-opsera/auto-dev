import { ATLASSIAN_JIRA_SCOPES } from '../../auth/constants.js';
import type { UserDocument } from '../../models/userModel.js';

export function userHasJiraScopes(user: UserDocument): boolean {
  const scopes = user.atlassian?.scopes ?? [];
  return ATLASSIAN_JIRA_SCOPES.every((scope) => scopes.includes(scope));
}
