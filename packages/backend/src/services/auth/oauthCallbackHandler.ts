import type { Request, Response } from 'express';
import {
  OAUTH_LINK_USER_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '../../auth/constants.js';
import {
  clearOAuthLinkUserCookie,
  clearPkceCookie,
  setSessionCookie,
} from '../../auth/cookies.js';
import { clearAuthFailures } from '../../auth/lockoutService.js';
import type { OAuthProviderConfig } from '../../auth/oauthConfig.js';
import { getClientIp, getCookieValue } from '../../auth/requestCookies.js';
import {
  createSession,
  touchSession,
  type SessionMetadata,
} from '../../auth/sessionService.js';
import type { UserRecord } from '../../models/userModel.js';
import {
  ensureNotLocked,
  handleAuthFailure,
  logAuthSuccess,
} from './authAuditHelpers.js';
import {
  linkProviderToUser,
  upsertUserFromOAuth,
  type OAuthProfile,
} from './userAuthService.js';

export const REFRESH_COOKIE_NAME = 'autodev_refresh';

export type OAuthCallbackProvider = 'github' | 'atlassian';

export interface CodeExchangeInput {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface CreatedSession {
  sessionId: string;
  refreshToken: string;
  metadata: SessionMetadata;
}

export interface OAuthCallbackHandlerDeps {
  exchangeCode: (input: CodeExchangeInput) => Promise<OAuthProfile>;
  upsertUser: (profile: OAuthProfile) => Promise<UserRecord>;
  linkProvider: (userId: string, profile: OAuthProfile) => Promise<UserRecord | null>;
  createUserSession: (userId: string) => Promise<CreatedSession>;
  touchUserSession: (sessionId: string) => Promise<{ userId: string } | null>;
  clearFailures: (ip: string) => void;
}

export interface RedirectCallbackOptions {
  req: Request;
  res: Response;
  provider: OAuthCallbackProvider;
  config: OAuthProviderConfig;
  /** Path after successful account linking (e.g. `/repositories`). */
  linkRedirectPath: string;
  /** Path after successful login redirect (default `/dashboard`). */
  loginRedirectPath?: string;
  /** Extra cookie/cleanup work after login (e.g. clear Atlassian remember). */
  afterLogin?: (res: Response) => void;
  deps: OAuthCallbackHandlerDeps;
}

export interface JsonLoginCallbackOptions {
  req: Request;
  res: Response;
  provider: OAuthCallbackProvider;
  config: OAuthProviderConfig;
  afterLogin?: (res: Response) => void;
  deps: OAuthCallbackHandlerDeps;
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

function resolveCodeAndVerifier(
  req: Request,
  source: 'query' | 'body',
): { code: string; codeVerifier: string } | null {
  const code =
    source === 'query'
      ? req.query.code
      : (req.body as { code?: string }).code;
  const bodyVerifier =
    source === 'body'
      ? (req.body as { code_verifier?: string }).code_verifier
      : undefined;
  const codeVerifier = bodyVerifier ?? getCookieValue(req, PKCE_COOKIE_NAME);

  if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
    return null;
  }

  return { code, codeVerifier };
}

/**
 * Determines whether the callback should link a provider to an existing session
 * (OAUTH_LINK_USER_COOKIE matches the active session) or create a new login.
 */
export async function resolveOAuthCallbackMode(
  req: Request,
  touchUserSession: OAuthCallbackHandlerDeps['touchUserSession'],
): Promise<'link' | 'login'> {
  const linkUserId = getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME);
  const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
  const existingSession = sessionId ? await touchUserSession(sessionId) : null;

  if (linkUserId && existingSession?.userId === linkUserId) {
    return 'link';
  }

  return 'login';
}

export async function handleOAuthRedirectCallback(
  options: RedirectCallbackOptions,
): Promise<void> {
  const {
    req,
    res,
    provider,
    config,
    linkRedirectPath,
    loginRedirectPath = '/dashboard',
    afterLogin,
    deps,
  } = options;

  ensureNotLocked(req);

  const params = resolveCodeAndVerifier(req, 'query');
  if (!params) {
    handleAuthFailure(req, { provider, reason: 'missing_oauth_parameters' });
  }

  try {
    const profile = await deps.exchangeCode({
      code: params.code,
      codeVerifier: params.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    const mode = await resolveOAuthCallbackMode(req, deps.touchUserSession);

    if (mode === 'link') {
      const linkUserId = getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME)!;
      const linked = await deps.linkProvider(linkUserId, profile);

      if (!linked) {
        handleAuthFailure(req, { provider, reason: 'link_user_not_found' });
      }

      deps.clearFailures(getClientIp(req));
      clearPkceCookie(res);
      clearOAuthLinkUserCookie(res);
      logAuthSuccess(req, linkUserId, provider);

      res.redirect(`${config.frontendUrl}${linkRedirectPath}`);
      return;
    }

    const user = await deps.upsertUser(profile);
    const session = await deps.createUserSession(String(user._id));

    deps.clearFailures(getClientIp(req));
    clearPkceCookie(res);
    setSessionCookie(res, session.sessionId);
    setRefreshCookie(res, session.refreshToken);
    afterLogin?.(res);
    logAuthSuccess(req, String(user._id), provider);

    res.redirect(`${config.frontendUrl}${loginRedirectPath}`);
  } catch {
    handleAuthFailure(req, { provider });
  }
}

export async function handleOAuthJsonLoginCallback(
  options: JsonLoginCallbackOptions,
): Promise<void> {
  const { req, res, provider, config, afterLogin, deps } = options;

  ensureNotLocked(req);

  const params = resolveCodeAndVerifier(req, 'body');
  if (!params) {
    handleAuthFailure(req, { provider, reason: 'missing_oauth_parameters' });
  }

  try {
    const profile = await deps.exchangeCode({
      code: params.code,
      codeVerifier: params.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    const user = await deps.upsertUser(profile);
    const session = await deps.createUserSession(String(user._id));

    deps.clearFailures(getClientIp(req));
    clearPkceCookie(res);
    setSessionCookie(res, session.sessionId);
    setRefreshCookie(res, session.refreshToken);
    afterLogin?.(res);
    logAuthSuccess(req, String(user._id), provider);

    res.status(200).json({
      user: {
        email: user.email,
        displayName: user.displayName,
        connectedProviders: user.connectedProviders,
      },
      session: session.metadata,
    });
  } catch {
    handleAuthFailure(req, { provider });
  }
}

/** Default wired dependencies for production route usage. */
export function createDefaultOAuthCallbackDeps(
  exchangeCode: (input: CodeExchangeInput) => Promise<OAuthProfile>,
): OAuthCallbackHandlerDeps {
  return {
    exchangeCode,
    upsertUser: upsertUserFromOAuth,
    linkProvider: linkProviderToUser,
    createUserSession: createSession,
    touchUserSession: touchSession,
    clearFailures: clearAuthFailures,
  };
}
