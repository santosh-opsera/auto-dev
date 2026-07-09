import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../utils/requestContext.js';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_ID_HEADER);
  const correlationId = incoming?.trim() ? incoming.trim() : randomUUID();

  res.setHeader('X-Correlation-ID', correlationId);

  runWithRequestContext(
    {
      correlationId,
      actor: 'anonymous',
      resource: req.path,
      operation: req.method,
    },
    () => {
      next();
    },
  );
}
