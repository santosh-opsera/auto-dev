import { Router, type Response } from 'express';
import {
  githubRateLimitStatusSchema,
  repositoryConnectResponseSchema,
  repositoryFileParamsSchema,
  repositoryFileResponseSchema,
  repositoryListResponseSchema,
  repositoryParamsSchema,
  repositoryTreeResponseSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateParams } from '../middleware/validateRequest.js';
import { repositoryService } from '../services/github/repositoryService.js';

export function createRepositoryRouter(): Router {
  const router = Router();

  router.get(
    '/rate-limit',
    asyncHandler(requireSession),
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      const payload = repositoryService.getRateLimitStatus();
      githubRateLimitStatusSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await repositoryService.listRepositories(req.user!);
      repositoryListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:owner/:repo/connect',
    asyncHandler(requireSession),
    validateParams(repositoryParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { owner, repo } = req.params as { owner: string; repo: string };
      const payload = await repositoryService.connectRepository(req.user!, owner, repo);
      repositoryConnectResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:owner/:repo/tree',
    asyncHandler(requireSession),
    validateParams(repositoryParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { owner, repo } = req.params as { owner: string; repo: string };
      const payload = await repositoryService.getRepositoryTree(req.user!, owner, repo);
      repositoryTreeResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:owner/:repo/files/{*path}',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const params = repositoryFileParamsSchema.parse({
        owner: req.params.owner,
        repo: req.params.repo,
        path: Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path,
      });
      const payload = await repositoryService.getRepositoryFile(
        req.user!,
        params.owner,
        params.repo,
        params.path,
      );
      repositoryFileResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
