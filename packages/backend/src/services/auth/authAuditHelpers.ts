import type { Request } from 'express';
import { getClientIp } from '../../auth/requestCookies.js';
import { isLockedOut, recordAuthFailure } from '../../auth/lockoutService.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';

export async function ensureNotLocked(req: Request): Promise<void> {
  if (await isLockedOut(getClientIp(req))) {
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

export async function handleAuthFailure(
  req: Request,
  metadata?: Record<string, unknown>,
): Promise<never> {
  void auditService.logSafe({
    resource: 'auth/sessions',
    operation: 'login_failed',
    actor: 'anonymous',
    ipAddress: getClientIp(req),
    newValue: metadata,
  });
  await recordAuthFailure(getClientIp(req));
  throw new AppError(
    'AuthenticationFailed',
    'Authentication failed.',
    401,
    'Verify OAuth credentials and retry.',
  );
}

export function logAuthSuccess(
  req: Request,
  userId: string,
  provider: 'github' | 'atlassian',
): void {
  void auditService.logSafe({
    resource: 'auth/sessions',
    operation: 'login',
    actor: userId,
    ipAddress: getClientIp(req),
    newValue: { provider },
  });
}
