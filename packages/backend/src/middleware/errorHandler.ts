import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { toErrorResponse } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

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

  res.status(statusCode).json(body);
};

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
