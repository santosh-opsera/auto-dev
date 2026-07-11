import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError, toErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { githubApiClient } from '../services/github/githubApiClient.js';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const { statusCode, body } = toErrorResponse(err);

  logger.error(body.message, {
    actor: 'system',
    resource: 'error-handler',
    operation: 'handleError',
  });

  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError && err.error === 'GitHubCircuitOpen') {
    const retryAfter = githubApiClient.getCircuitBreaker().getRetryAfterSeconds() ?? 30;
    res.setHeader('Retry-After', String(retryAfter));
  }

  res.status(statusCode).json(body);
};

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
