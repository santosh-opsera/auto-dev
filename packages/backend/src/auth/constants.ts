export const SESSION_COOKIE_NAME = 'autodev_session';
export const PKCE_COOKIE_NAME = 'autodev_pkce_verifier';
export const ATLASSIAN_REMEMBER_COOKIE_NAME = 'autodev_atlassian_uid';
export const OAUTH_LINK_USER_COOKIE_NAME = 'autodev_oauth_link_uid';

export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
export const SESSION_WARNING_MS = 5 * 60 * 1000;
export const ATLASSIAN_REMEMBER_MS = 90 * 24 * 60 * 60 * 1000;

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export const AUTH_RATE_LIMIT_MAX = 100;
export const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const STANDARD_RATE_LIMIT_MAX = 1000;
export const STANDARD_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const GITHUB_SCOPES = ['read:user', 'user:email'];

export const ATLASSIAN_LOGIN_SCOPES = ['read:me', 'offline_access'];
export const ATLASSIAN_JIRA_SCOPES = ['read:jira-work', 'read:jira-user'];

/** @deprecated Use ATLASSIAN_LOGIN_SCOPES. */
export const ATLASSIAN_SCOPES = [...ATLASSIAN_LOGIN_SCOPES, ...ATLASSIAN_JIRA_SCOPES];
