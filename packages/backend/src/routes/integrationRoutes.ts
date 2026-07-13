import { Router, type Response } from 'express';
import { integrationsListResponseSchema } from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { adapterRegistry } from '../services/integrations/adapterRegistry.js';
import { registerDefaultAdapters } from '../services/integrations/registerDefaultAdapters.js';

export function createIntegrationRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    asyncHandler(requireSession),
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      registerDefaultAdapters();
      const payload = integrationsListResponseSchema.parse({
        adapters: adapterRegistry.list(),
      });
      res.status(200).json(payload);
    }),
  );

  return router;
}
