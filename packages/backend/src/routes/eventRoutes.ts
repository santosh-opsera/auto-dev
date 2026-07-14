import { Router, type Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { eventBus } from '@autodev/infrastructure';
import { sseManager } from '../services/events/sseManager.js';

sseManager.initializeEventBusBridge(eventBus);

export function createEventRouter(): Router {
  const router = Router();

  router.get(
    '/stream',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = String(req.user!._id);

      sseManager.writeStreamHeaders(res);
      sseManager.registerConnection(userId, res);
    }),
  );

  return router;
}
