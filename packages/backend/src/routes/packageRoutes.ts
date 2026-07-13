import { Router, type Response } from 'express';
import {
  dependencyScanRequestSchema,
  dependencyScanResponseSchema,
  dependencyUpdateProposalIdParamsSchema,
  dependencyUpdateProposalListResponseSchema,
  dependencyUpdateProposalSchema,
  outdatedDependenciesResponseSchema,
  packageBumpNotifyRequestSchema,
  packageBumpNotifyResponseSchema,
  packageConfirmRequestSchema,
  packageConsumersResponseSchema,
  packageDetectRequestSchema,
  packageDetectResponseSchema,
  packageNameParamsSchema,
  packageProposalIdParamsSchema,
  packagePublishProposalSchema,
  packagePublishRequestSchema,
  repositoryParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { dependencyTrackingService } from '../services/packages/dependencyTrackingService.js';
import { packagePublishService } from '../services/packages/packagePublishService.js';

function resolvePackageNameParam(raw: unknown): string {
  if (Array.isArray(raw)) {
    return decodeURIComponent(raw.join('/'));
  }
  if (typeof raw === 'string') {
    return decodeURIComponent(raw);
  }
  return '';
}

export function createPackageRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/detect',
    asyncHandler(requireSession),
    validateBody(packageDetectRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await packagePublishService.detect(req.user!, req.body);
      packageDetectResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/proposals/:id',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await packagePublishService.getProposal(req.user!, id);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/proposals/:id/confirm',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    validateBody(packageConfirmRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const { confirmationToken } = req.body as { confirmationToken: string };
      const payload = await packagePublishService.confirm(req.user!, id, confirmationToken);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/proposals/:id/publish',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    validateBody(packagePublishRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const { confirmationToken } = req.body as { confirmationToken: string };
      const payload = await packagePublishService.publish(req.user!, id, confirmationToken);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/dependency-scan',
    asyncHandler(requireSession),
    validateBody(dependencyScanRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await dependencyTrackingService.scanRepositories(req.user!, req.body);
      dependencyScanResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.post(
    '/dependency-updates/notify',
    asyncHandler(requireSession),
    validateBody(packageBumpNotifyRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await dependencyTrackingService.proposeUpdatesForBump(req.user!, req.body);
      packageBumpNotifyResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/dependency-updates',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await dependencyTrackingService.listProposals(req.user!);
      dependencyUpdateProposalListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/dependency-updates/:id',
    asyncHandler(requireSession),
    validateParams(dependencyUpdateProposalIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await dependencyTrackingService.getProposal(req.user!, id);
      dependencyUpdateProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/{*name}/consumers',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const name = resolvePackageNameParam(req.params.name);
      packageNameParamsSchema.parse({ name });
      const payload = await dependencyTrackingService.getConsumers(req.user!, name);
      packageConsumersResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}

/** Mount on /api/v1/repositories for outdated-dependencies. */
export function createRepositoryDependencyRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:owner/:repo/outdated-dependencies',
    asyncHandler(requireSession),
    validateParams(repositoryParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { owner, repo } = req.params as { owner: string; repo: string };
      const payload = await dependencyTrackingService.getOutdatedDependencies(
        req.user!,
        owner,
        repo,
      );
      outdatedDependenciesResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
