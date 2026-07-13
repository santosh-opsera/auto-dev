import { Router, type Response } from 'express';
import {
  createPullRequestRequestSchema,
  pullRequestResponseSchema,
  workflowIdParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { prCreationService } from '../services/github/prCreationService.js';

export function createPullRequestRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(createPullRequestRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await prCreationService.createPullRequest(req.user!, id, req.body);
      pullRequestResponseSchema.parse(payload);
      res.status(payload.created ? 201 : 200).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await prCreationService.getPullRequest(req.user!, id);
      pullRequestResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
