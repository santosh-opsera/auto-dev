import { randomUUID } from 'node:crypto';
import type { DivergenceDetectionResponse } from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getDivergenceRecordModel } from '../../models/divergenceRecordModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { AppError } from '../../utils/errors.js';
import { eventBus } from '@autodev/infrastructure';
import { buildDivergenceSummary, detectDivergences } from './divergenceDetector.js';

export interface DetectDivergenceOptions {
  owner: string;
  repo: string;
  workflowId: string;
}

export class DivergenceDetectionService {
  async detectDivergence(
    user: UserDocument,
    ticketKey: string,
    options: DetectDivergenceOptions,
  ): Promise<DivergenceDetectionResponse> {
    const ticketIntentRecord = await getTicketIntentModel()
      .findOne({ userId: String(user._id), ticketKey })
      .sort({ createdAt: -1 })
      .exec();

    if (!ticketIntentRecord) {
      throw new AppError(
        'TicketIntentNotFound',
        'Ticket intent has not been parsed yet.',
        412,
        'Parse the ticket before running divergence detection.',
      );
    }

    const codebaseContextRecord = await getCodebaseContextModel()
      .findOne({ userId: String(user._id), owner: options.owner, repo: options.repo })
      .sort({ updatedAt: -1 })
      .exec();

    if (!codebaseContextRecord) {
      throw new AppError(
        'CodebaseContextNotFound',
        'Codebase analysis has not been run for this repository.',
        412,
        'Analyze the repository before running divergence detection.',
      );
    }

    const intent = {
      ticketKey: ticketIntentRecord.ticketKey,
      problemStatement: ticketIntentRecord.problemStatement,
      proposedApproach: ticketIntentRecord.proposedApproach,
      acceptanceCriteria: ticketIntentRecord.acceptanceCriteria,
      affectedComponents: ticketIntentRecord.affectedComponents,
      dependencies: ticketIntentRecord.dependencies,
      constraints: ticketIntentRecord.constraints,
      metadata: ticketIntentRecord.metadata,
    };

    const divergences = detectDivergences(intent, codebaseContextRecord.context);
    const summary = buildDivergenceSummary(divergences);
    const aligned = divergences.length === 0;

    const record = await getDivergenceRecordModel().create({
      userId: String(user._id),
      ticketKey,
      ticketIntentId: ticketIntentRecord._id.toString(),
      codebaseContextId: codebaseContextRecord._id.toString(),
      owner: options.owner,
      repo: options.repo,
      workflowId: options.workflowId,
      divergences,
      aligned,
      summary,
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    await getTicketIntentModel()
      .updateOne(
        { _id: ticketIntentRecord._id },
        { $set: { updatedBy: String(user._id), latestDivergenceRecordId: record._id.toString() } },
      )
      .exec();

    if (aligned) {
      await eventBus.publish(
        {
          type: 'DIVERGENCE_NONE',
          payload: {
            ticketKey,
            workflowId: options.workflowId,
            owner: options.owner,
            repo: options.repo,
            summary,
          },
          metadata: this.buildMetadata(user, ticketKey, options.workflowId),
        },
        { awaitHandlers: true },
      );
    } else {
      for (const divergence of divergences) {
        await eventBus.publish(
          {
            type: 'DIVERGENCE_DETECTED',
            payload: {
              ticketKey,
              workflowId: options.workflowId,
              summary: `${divergence.type}: ${divergence.recommendation}`,
              divergenceType: divergence.type,
              severity: divergence.severity,
            },
            metadata: this.buildMetadata(user, ticketKey, options.workflowId),
          },
          { awaitHandlers: true },
        );
      }
    }

    return {
      ticketKey,
      workflowId: options.workflowId,
      owner: options.owner,
      repo: options.repo,
      divergences,
      aligned,
      summary,
      persistedId: record._id.toString(),
      ticketIntentId: ticketIntentRecord._id.toString(),
      codebaseContextId: codebaseContextRecord._id.toString(),
    };
  }

  private buildMetadata(user: UserDocument, ticketKey: string, workflowId: string) {
    return {
      eventId: randomUUID(),
      correlationId: `ticket-${ticketKey}:${workflowId}`,
      actor: String(user._id),
      userId: String(user._id),
      timestamp: new Date().toISOString(),
    };
  }
}

export const divergenceDetectionService = new DivergenceDetectionService();
