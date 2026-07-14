import { Router, type Response } from 'express';
import {
  ATLASSIAN_JIRA_SCOPES,
  ATLASSIAN_LOGIN_SCOPES,
  GITHUB_LOGIN_SCOPES,
  GITHUB_REPO_CONNECT_SCOPES,
  SESSION_COOKIE_NAME,
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
import { clearAuthFailures } from '../auth/lockoutService.js';
import { authRateLimitMiddleware } from '../middleware/appRateLimits.js';
import { getAtlassianConfig, getGitHubConfig } from '../auth/oauthConfig.js';
import { generateStateToken } from '../auth/pkce.js';
import { getClientIp, getCookieValue } from '../auth/requestCookies.js';
import {
  invalidateSession,
  rotateRefreshToken,
  touchSession,
} from '../auth/sessionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/errors.js';
import { findUserById } from '../models/userModel.js';
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
import { handleAuthFailure } from '../services/auth/authAuditHelpers.js';
import {
  REFRESH_COOKIE_NAME,
  createDefaultOAuthCallbackDeps,
  handleOAuthJsonLoginCallback,
  handleOAuthRedirectCallback,
} from '../services/auth/oauthCallbackHandler.js';
import { auditService } from '../services/audit/auditService.js';
import { sseManager } from '../services/events/sseManager.js';

/**
 * Atlassian sign-in resume is retired (GitHub-only login). Clear stale remember cookie.
 */
function clearStaleAtlassianRemember(res: Response): void {
  clearAtlassianRememberCookie(res);
}

export function createAuthRouter(): Router {
  const router = Router();
  const githubCallbackDeps = createDefaultOAuthCallbackDeps(exchangeGitHubCode);
  const atlassianCallbackDeps = createDefaultOAuthCallbackDeps(exchangeAtlassianCode);

  router.use(authRateLimitMiddleware);

  router.get('/github/start', (_req, res) => {
    const { clientId, redirectUri } = getGitHubConfig();
    const { codeVerifier, codeChallenge } = createGitHubPkcePair();
    const state = generateStateToken();
    setPkceCookie(res, codeVerifier);

    res.redirect(
      buildGitHubAuthorizationUrl(clientId, redirectUri, codeChallenge, state),
    );
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

      res.redirect(
        buildGitHubAuthorizationUrl(
          clientId,
          redirectUri,
          codeChallenge,
          state,
          [...GITHUB_LOGIN_SCOPES, ...GITHUB_REPO_CONNECT_SCOPES],
        ),
      );
    }),
  );

  router.post(
    '/github/callback',
    asyncHandler(async (req, res) => {
      await handleOAuthJsonLoginCallback({
        req,
        res,
        provider: 'github',
        config: getGitHubConfig(),
        deps: githubCallbackDeps,
      });
    }),
  );

  router.get(
    '/github/callback',
    asyncHandler(async (req, res) => {
      await handleOAuthRedirectCallback({
        req,
        res,
        provider: 'github',
        config: getGitHubConfig(),
        linkRedirectPath: '/repositories',
        deps: githubCallbackDeps,
      });
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
      await handleOAuthJsonLoginCallback({
        req,
        res,
        provider: 'atlassian',
        config: getAtlassianConfig(),
        afterLogin: clearStaleAtlassianRemember,
        deps: atlassianCallbackDeps,
      });
    }),
  );

  router.get(
    '/atlassian/callback',
    asyncHandler(async (req, res) => {
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

      await handleOAuthRedirectCallback({
        req,
        res,
        provider: 'atlassian',
        config: getAtlassianConfig(),
        linkRedirectPath: '/integrations',
        afterLogin: clearStaleAtlassianRemember,
        deps: atlassianCallbackDeps,
      });
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
            atlassianEmail: user.atlassian?.accountEmail ?? undefined,
          },
        },
        session: metadata,
      });
    }),
  );

  return router;
}
