import { Router, type Response } from 'express';
import { ticketKeyParamsSchema, ticketParseResponseSchema, ticketResponseSchema } from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateParams } from '../middleware/validateRequest.js';
import { ticketService } from '../services/jira/ticketService.js';
import { ticketParseService } from '../services/tickets/ticketParseService.js';

export function createTicketRouter(): Router {
  const router = Router();

  router.get(
    '/:ticketKey',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const payload = await ticketService.getTicket(req.user!, ticketKey);
      ticketResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:ticketKey/parse',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const payload = await ticketParseService.parseTicket(req.user!, ticketKey);
      ticketParseResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
