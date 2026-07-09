export const SESSION_COOKIE_NAME = 'autodev_session';
export const PKCE_COOKIE_NAME = 'autodev_pkce_verifier';

export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
export const SESSION_WARNING_MS = 5 * 60 * 1000;

export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export const AUTH_RATE_LIMIT_MAX = 100;
export const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const GITHUB_SCOPES = ['read:user', 'user:email'];
export const ATLASSIAN_SCOPES = ['read:jira-work', 'read:jira-user', 'offline_access'];
