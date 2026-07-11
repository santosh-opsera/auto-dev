import type { TicketParseResponse } from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { eventBus } from '../events/eventBus.js';
import { ticketService } from '../jira/ticketService.js';
import { canProceedToAnalysis, detectTicketGaps } from './gapDetectionService.js';
import { parseTicketIntent } from './ticketParser.js';

export class TicketParseService {
  async parseTicket(user: UserDocument, ticketKey: string): Promise<TicketParseResponse> {
    const ticketResponse = await ticketService.getTicket(user, ticketKey);
    const intent = parseTicketIntent(ticketResponse.ticket);
    const gaps = detectTicketGaps(ticketResponse.ticket, intent);
    const proceed = canProceedToAnalysis(gaps);

    const record = await getTicketIntentModel().create({
      userId: String(user._id),
      ticketKey: intent.ticketKey,
      problemStatement: intent.problemStatement,
      proposedApproach: intent.proposedApproach,
      acceptanceCriteria: intent.acceptanceCriteria,
      affectedComponents: intent.affectedComponents,
      dependencies: intent.dependencies,
      constraints: intent.constraints,
      metadata: intent.metadata,
      gaps,
      canProceedToAnalysis: proceed,
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    if (proceed) {
      await eventBus.publish(
        {
          type: 'TICKET_PARSED',
          payload: {
            ticketKey: intent.ticketKey,
            summary: intent.problemStatement,
          },
          metadata: {
            eventId: `ticket-parsed-${record._id.toString()}`,
            correlationId: `ticket-${intent.ticketKey}`,
            actor: String(user._id),
            userId: String(user._id),
            timestamp: new Date().toISOString(),
          },
        },
        { awaitHandlers: true },
      );
    }

    return {
      intent,
      gaps,
      canProceedToAnalysis: proceed,
      persistedId: record._id.toString(),
    };
  }
}

export const ticketParseService = new TicketParseService();
