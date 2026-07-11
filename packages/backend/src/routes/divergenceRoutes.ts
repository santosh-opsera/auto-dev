import { Router, type Response } from 'express';
import {
  divergenceDetectionRequestSchema,
  divergenceDetectionResponseSchema,
  ticketKeyParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { divergenceDetectionService } from '../services/divergence/divergenceDetectionService.js';

export function createDivergenceRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    validateBody(divergenceDetectionRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const body = req.body as {
        owner: string;
        repo: string;
        workflowId: string;
      };

      const payload = await divergenceDetectionService.detectDivergence(
        req.user!,
        ticketKey,
        body,
      );

      divergenceDetectionResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
