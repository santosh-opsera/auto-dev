import { Router, type Response } from 'express';
import {
  codebaseAnalysisRequestSchema,
  codebaseAnalysisResponseSchema,
  repositoryParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { codebaseAnalysisService } from '../services/analysis/codebaseAnalysisService.js';

export function createAnalysisRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateParams(repositoryParamsSchema),
    validateBody(codebaseAnalysisRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { owner, repo } = req.params as { owner: string; repo: string };
      const body = req.body as {
        ticketKey?: string;
        workflowId?: string;
        forceRefresh?: boolean;
      };

      const payload = await codebaseAnalysisService.analyzeRepository(
        req.user!,
        owner,
        repo,
        body,
      );

      codebaseAnalysisResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
