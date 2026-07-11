import { Router, type Response } from 'express';
import { auditLogListQuerySchema, auditLogListResponseSchema } from '@autodev/shared-types';
import { formatZodError, RequestValidationError } from '../utils/errors.js';
import {
  requireAdmin,
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditService } from '../services/audit/auditService.js';

export function createAuditRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(requireSession),
    requireAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = auditLogListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new RequestValidationError(formatZodError(parsed.error));
      }

      const query = parsed.data;
      const payload = await auditService.query(
        {
          actor: query.actor,
          resource: query.resource,
          operation: query.operation,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
        },
        query.page,
        query.limit,
      );

      auditLogListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
