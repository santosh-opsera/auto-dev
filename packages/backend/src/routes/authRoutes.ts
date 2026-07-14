import { Router, type Request, type Response } from 'express';
import {
  ATLASSIAN_JIRA_SCOPES,
  ATLASSIAN_LOGIN_SCOPES,
  GITHUB_LOGIN_SCOPES,
  GITHUB_REPO_CONNECT_SCOPES,
  OAUTH_LINK_USER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  PKCE_COOKIE_NAME,
} from '../auth/constants.js';
import {
  clearAtlassianRememberCookie,
  clearOAuthLinkUserCookie,
  clearPkceCookie,
  clearSessionCookie,
  setOAuthLinkUserCookie,
  setPkceCookie,
  setSessionCookie,
} from '../auth/cookies.js';
import { clearAuthFailures, isLockedOut, recordAuthFailure } from '../auth/lockoutService.js';
import { authRateLimitMiddleware } from '../middleware/appRateLimits.js';
import { generateStateToken } from '../auth/pkce.js';
import {
  createSession,
  invalidateSession,
  rotateRefreshToken,
  touchSession,
} from '../auth/sessionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/errors.js';
import { findUserById, getUserModel } from '../models/userModel.js';
import { userHasGitHubRepoScopes } from '../services/github/githubScopes.js';
import { userHasJiraScopes } from '../services/jira/jiraScopes.js';
import {
  buildGitHubAuthorizationUrl,
  createGitHubPkcePair,
  exchangeGitHubCode,
} from '../services/auth/githubAuthService.js';
import {
  buildAtlassianAuthorizationUrl,
  createAtlassianPkcePair,
  exchangeAtlassianCode,
} from '../services/auth/atlassianAuthService.js';
import { upsertUserFromOAuth, linkProviderToUser } from '../services/auth/userAuthService.js';
import { auditService } from '../services/audit/auditService.js';
import { sseManager } from '../services/events/sseManager.js';

const REFRESH_COOKIE_NAME = 'autodev_refresh';

function getClientIp(req: Request): string {
  return req.ip ?? 'unknown';
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown>;
  const value = cookies[name];
  return typeof value === 'string' ? value : undefined;
}

function getAtlassianConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
} {
  return {
    clientId: process.env.ATLASSIAN_CLIENT_ID ?? 'atlassian-client-id',
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET ?? 'atlassian-client-secret',
    redirectUri:
      process.env.ATLASSIAN_REDIRECT_URI ?? 'http://localhost:3002/api/v1/auth/atlassian/callback',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  };
}

function getGitHubConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
} {
  return {
    clientId: process.env.GITHUB_CLIENT_ID ?? 'github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'github-client-secret',
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ?? 'http://localhost:3002/api/v1/auth/github/callback',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  };
}

/**
 * Atlassian sign-in resume is retired (GitHub-only login). Clear stale remember cookie.
 */
function clearStaleAtlassianRemember(res: Response): void {
  clearAtlassianRememberCookie(res);
}

function ensureNotLocked(req: Request): void {
  if (isLockedOut(getClientIp(req))) {
    void auditService.logSafe({
      resource: 'auth/sessions',
      operation: 'lockout',
      actor: 'anonymous',
      ipAddress: getClientIp(req),
    });
    throw new AppError(
      'AccountLocked',
      'Too many failed authentication attempts. Try again later.',
      423,
      'Wait 15 minutes before retrying authentication.',
    );
  }
}

function handleAuthFailure(req: Request, metadata?: Record<string, unknown>): never {
  void auditService.logSafe({
    resource: 'auth/sessions',
    operation: 'login_failed',
    actor: 'anonymous',
    ipAddress: getClientIp(req),
    newValue: metadata,
  });
  recordAuthFailure(getClientIp(req));
  throw new AppError(
    'AuthenticationFailed',
    'Authentication failed.',
    401,
    'Verify OAuth credentials and retry.',
  );
}

function logAuthSuccess(req: Request, userId: string, provider: 'github' | 'atlassian'): void {
  void auditService.logSafe({
    resource: 'auth/sessions',
    operation: 'login',
    actor: userId,
    ipAddress: getClientIp(req),
    newValue: { provider },
  });
}

export function createAuthRouter(): Router {
  const router = Router();

  router.use(authRateLimitMiddleware);

  router.get('/github/start', (_req, res) => {
      const { clientId, redirectUri } = getGitHubConfig();
      const { codeVerifier, codeChallenge } = createGitHubPkcePair();
      const state = generateStateToken();
      setPkceCookie(res, codeVerifier);

      const authorizationUrl = buildGitHubAuthorizationUrl(
        clientId,
        redirectUri,
        codeChallenge,
        state,
      );

      res.redirect(authorizationUrl);
  });

  router.get(
    '/github/repos/connect',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
      if (!sessionId) {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in before connecting GitHub.');
      }

      const session = await touchSession(sessionId);
      if (!session) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in before connecting GitHub.');
      }

      const { clientId, redirectUri } = getGitHubConfig();
      const { codeVerifier, codeChallenge } = createGitHubPkcePair();
      const state = generateStateToken();
      setPkceCookie(res, codeVerifier);
      setOAuthLinkUserCookie(res, session.userId);

      const authorizationUrl = buildGitHubAuthorizationUrl(
        clientId,
        redirectUri,
        codeChallenge,
        state,
        [...GITHUB_LOGIN_SCOPES, ...GITHUB_REPO_CONNECT_SCOPES],
      );

      res.redirect(authorizationUrl);
    }),
  );

  router.post(
    '/github/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const { code, code_verifier: bodyVerifier } = req.body as {
        code?: string;
        code_verifier?: string;
      };
      const codeVerifier = bodyVerifier ?? getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req, { provider: 'github', reason: 'missing_oauth_parameters' });
      }

      try {
        const config = getGitHubConfig();
        const profile = await exchangeGitHubCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        logAuthSuccess(req, String(user._id), 'github');

        res.status(200).json({
          user: {
            email: user.email,
            displayName: user.displayName,
            connectedProviders: user.connectedProviders,
          },
          session: session.metadata,
        });
      } catch {
        handleAuthFailure(req, { provider: 'github' });
      }
    }),
  );

  router.get(
    '/github/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const code = req.query.code;
      const codeVerifier = getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req, { provider: 'github', reason: 'missing_oauth_parameters' });
      }

      try {
        const config = getGitHubConfig();
        const profile = await exchangeGitHubCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const linkUserId = getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME);
        const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
        const existingSession = sessionId ? await touchSession(sessionId) : null;

        if (linkUserId && existingSession?.userId === linkUserId) {
          const linked = await linkProviderToUser(linkUserId, profile);

          if (!linked) {
            handleAuthFailure(req, { provider: 'github', reason: 'link_user_not_found' });
          }

          clearAuthFailures(getClientIp(req));
          clearPkceCookie(res);
          clearOAuthLinkUserCookie(res);
          logAuthSuccess(req, linkUserId, 'github');

          res.redirect(`${config.frontendUrl}/repositories`);
          return;
        }

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        logAuthSuccess(req, String(user._id), 'github');

        res.redirect(`${config.frontendUrl}/dashboard`);
      } catch {
        handleAuthFailure(req, { provider: 'github' });
      }
    }),
  );

  router.get('/prepare-login', (_req, res) => {
    clearStaleAtlassianRemember(res);
    res.status(204).send();
  });

  router.get(
    '/atlassian/start',
    asyncHandler(async (_req, res) => {
      clearStaleAtlassianRemember(res);
      throw new AppError(
        'AtlassianLoginRemoved',
        'Atlassian sign-in is no longer available. Log in with GitHub, then connect Jira from Integrations.',
        410,
        'Use Continue with GitHub, then connect Jira after you are signed in.',
      );
    }),
  );

  router.get(
    '/atlassian/jira/connect',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
      if (!sessionId) {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in before connecting Jira.');
      }

      const session = await touchSession(sessionId);
      if (!session) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in before connecting Jira.');
      }

      const { clientId, redirectUri } = getAtlassianConfig();
      const { codeVerifier, codeChallenge } = createAtlassianPkcePair();
      const state = generateStateToken();
      setPkceCookie(res, codeVerifier);
      setOAuthLinkUserCookie(res, session.userId);

      res.redirect(
        buildAtlassianAuthorizationUrl(
          clientId,
          redirectUri,
          codeChallenge,
          state,
          'consent',
          [...ATLASSIAN_LOGIN_SCOPES, ...ATLASSIAN_JIRA_SCOPES],
        ),
      );
    }),
  );

  router.post(
    '/atlassian/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const { code, code_verifier: bodyVerifier } = req.body as {
        code?: string;
        code_verifier?: string;
      };
      const codeVerifier = bodyVerifier ?? getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req, { provider: 'atlassian', reason: 'missing_oauth_parameters' });
      }

      try {
        const config = getAtlassianConfig();
        const profile = await exchangeAtlassianCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        clearStaleAtlassianRemember(res);
        logAuthSuccess(req, String(user._id), 'atlassian');

        res.status(200).json({
          user: {
            email: user.email,
            displayName: user.displayName,
            connectedProviders: user.connectedProviders,
          },
          session: session.metadata,
        });
      } catch {
        handleAuthFailure(req, { provider: 'atlassian' });
      }
    }),
  );

  router.get(
    '/atlassian/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const oauthError = req.query.error;
      if (typeof oauthError === 'string') {
        const frontendUrl = getAtlassianConfig().frontendUrl;
        clearStaleAtlassianRemember(res);
        clearPkceCookie(res);
        clearOAuthLinkUserCookie(res);
        res.redirect(
          `${frontendUrl}/login?error=atlassian_oauth&reason=${encodeURIComponent(oauthError)}`,
        );
        return;
      }

      const code = req.query.code;
      const codeVerifier = getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req, { provider: 'atlassian', reason: 'missing_oauth_parameters' });
      }

      try {
        const config = getAtlassianConfig();
        const profile = await exchangeAtlassianCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const linkUserId = getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME);
        const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
        const existingSession = sessionId ? await touchSession(sessionId) : null;

        if (linkUserId && existingSession?.userId === linkUserId) {
          const linked = await linkProviderToUser(linkUserId, profile);

          if (!linked) {
            handleAuthFailure(req, { provider: 'atlassian', reason: 'link_user_not_found' });
          }

          clearAuthFailures(getClientIp(req));
          clearPkceCookie(res);
          clearOAuthLinkUserCookie(res);
          logAuthSuccess(req, linkUserId, 'atlassian');

          res.redirect(`${config.frontendUrl}/tickets`);
          return;
        }

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        clearStaleAtlassianRemember(res);
        logAuthSuccess(req, String(user._id), 'atlassian');

        res.redirect(`${config.frontendUrl}/dashboard`);
      } catch {
        handleAuthFailure(req, { provider: 'atlassian' });
      }
    }),
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
      const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string' || !refreshToken || typeof refreshToken !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const rotated = await rotateRefreshToken(sessionId, refreshToken);

      if (!rotated) {
        handleAuthFailure(req, { reason: 'invalid_refresh_token' });
      }

      clearAuthFailures(getClientIp(req));
      setSessionCookie(res, sessionId);
      res.cookie(REFRESH_COOKIE_NAME, rotated.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      void auditService.logSafe({
        resource: 'auth/sessions',
        operation: 'token_refresh',
        actor: rotated.metadata.userId,
        ipAddress: getClientIp(req),
        newValue: { sessionId },
      });

      res.status(200).json({ session: rotated.metadata });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
      const sessionMetadata = sessionId ? await touchSession(sessionId) : null;

      if (sessionId && typeof sessionId === 'string') {
        await invalidateSession(sessionId);
      }

      if (sessionMetadata?.userId) {
        sseManager.closeUserConnections(sessionMetadata.userId);
      }

      void auditService.logSafe({
        resource: 'auth/sessions',
        operation: 'logout',
        actor: sessionMetadata?.userId ?? 'anonymous',
        ipAddress: getClientIp(req),
        previousValue: sessionId ? { sessionId } : undefined,
      });

      clearSessionCookie(res);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      res.status(204).send();
    }),
  );

  router.post(
    '/heartbeat',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const metadata = await touchSession(sessionId);

      if (!metadata) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in again.');
      }

      res.status(200).json({
        session: metadata,
        warning: metadata.warning
          ? 'Your session will expire in less than 5 minutes.'
          : undefined,
      });
    }),
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const metadata = await touchSession(sessionId);

      if (!metadata) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in again.');
      }

      const user = await findUserById(metadata.userId);

      if (!user) {
        throw new AppError('Unauthorized', 'User not found.', 401, 'Sign in again.');
      }

      res.status(200).json({
        user: {
          email: user.email,
          displayName: user.displayName,
          connectedProviders: user.connectedProviders,
          integrations: {
            jira: userHasJiraScopes(user),
            githubRepos: userHasGitHubRepoScopes(user),
          },
        },
        session: metadata,
      });
    }),
  );

  return router;
}
