import { Router, type Response } from 'express';
import {
  qaHandoffApproveRequestSchema,
  qaHandoffGenerateRequestSchema,
  qaHandoffRequestChangesRequestSchema,
  qaHandoffResponseSchema,
  workflowIdParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { qaHandoffService } from '../services/qa/qaHandoffService.js';

export function createQaHandoffRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(qaHandoffGenerateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await qaHandoffService.generate(req.user!, id, req.body);
      qaHandoffResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await qaHandoffService.get(req.user!, id);
      qaHandoffResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/approve',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(qaHandoffApproveRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await qaHandoffService.approve(req.user!, id, req.body);
      qaHandoffResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/request-changes',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(qaHandoffRequestChangesRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await qaHandoffService.requestChanges(req.user!, id, req.body);
      qaHandoffResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
