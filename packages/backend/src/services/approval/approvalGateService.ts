import { randomUUID } from 'node:crypto';
import {
  APPROVAL_TTL_HOURS,
  type ApprovalAction,
  type ApprovalItem,
  type ApprovalRequestResponse,
  type ApprovalResolveRequest,
  type ApprovalStatusResponse,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getApprovalRequestModel,
  type ApprovalItemRecord,
  type ApprovalRequest,
} from '../../models/approvalRequestModel.js';
import { getDivergenceRecordModel } from '../../models/divergenceRecordModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '@autodev/infrastructure';

function toIso(date: Date): string {
  return date.toISOString();
}

function mapItem(item: ApprovalItemRecord): ApprovalItem {
  const mapped: ApprovalItem = {
    itemId: item.itemId,
    type: item.type,
    status: item.status,
    sourceRef: item.sourceRef,
    title: item.title,
    summary: item.summary,
    remindersSent: item.remindersSent ?? [],
  };

  if (item.gap?.field) {
    mapped.gap = item.gap;
  }
  if (item.divergence?.ticketApproach) {
    mapped.divergence = item.divergence;
  }
  if (item.decision?.action) {
    mapped.decision = item.decision;
  }

  return mapped;
}

function mapRequest(doc: ApprovalRequest): ApprovalRequestResponse {
  return {
    id: doc._id.toString(),
    ticketKey: doc.ticketKey,
    workflowId: doc.workflowId,
    ticketIntentId: doc.ticketIntentId,
    divergenceRecordId: doc.divergenceRecordId,
    status: doc.status,
    items: doc.items.map(mapItem),
    expiresAt: toIso(doc.expiresAt),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function computeRequestStatus(
  items: ApprovalItemRecord[],
): 'open' | 'cleared' | 'blocked' {
  const pendingCount = items.filter((item) => item.status === 'pending').length;
  const expiredCount = items.filter((item) => item.status === 'expired').length;

  if (expiredCount > 0) {
    return 'blocked';
  }
  if (pendingCount === 0 && items.length > 0) {
    return 'cleared';
  }
  return 'open';
}

function buildStatus(doc: ApprovalRequest): ApprovalStatusResponse {
  const pendingCount = doc.items.filter((item) => item.status === 'pending').length;
  const expiredCount = doc.items.filter((item) => item.status === 'expired').length;
  const resolvedCount = doc.items.filter((item) =>
    ['approved', 'rejected', 'modified'].includes(item.status),
  ).length;

  return {
    requestId: doc._id.toString(),
    ticketKey: doc.ticketKey,
    canProceed: pendingCount === 0 && expiredCount === 0 && doc.items.length > 0,
    pendingCount,
    expiredCount,
    resolvedCount,
    totalCount: doc.items.length,
    status: doc.status,
    expiresAt: toIso(doc.expiresAt),
  };
}

export class ApprovalGateService {
  async createApprovalRequest(
    user: UserDocument,
    ticketKey: string,
    workflowId: string,
  ): Promise<ApprovalRequestResponse> {
    const ticketIntentRecord = await getTicketIntentModel()
      .findOne({ userId: String(user._id), ticketKey })
      .sort({ createdAt: -1 })
      .exec();

    if (!ticketIntentRecord) {
      throw new AppError(
        'TicketIntentNotFound',
        'Ticket intent has not been parsed yet.',
        412,
        'Parse the ticket before creating an approval request.',
      );
    }

    let divergenceRecord = null;
    if (ticketIntentRecord.latestDivergenceRecordId) {
      divergenceRecord = await getDivergenceRecordModel()
        .findById(ticketIntentRecord.latestDivergenceRecordId)
        .exec();
    }

    if (!divergenceRecord) {
      divergenceRecord = await getDivergenceRecordModel()
        .findOne({ userId: String(user._id), ticketKey })
        .sort({ createdAt: -1 })
        .exec();
    }

    const items: ApprovalItemRecord[] = [];

    for (const gap of ticketIntentRecord.gaps ?? []) {
      items.push({
        itemId: randomUUID(),
        type: 'gap',
        status: 'pending',
        sourceRef: gap.field,
        title: `Gap: ${gap.field}`,
        summary: gap.description,
        gap: {
          field: gap.field,
          severity: gap.severity,
          description: gap.description,
          suggestedAction: gap.suggestedAction,
        },
        remindersSent: [],
      });
    }

    if (divergenceRecord) {
      divergenceRecord.divergences.forEach((divergence, index) => {
        items.push({
          itemId: randomUUID(),
          type: 'divergence',
          status: 'pending',
          sourceRef: `${divergence.type}-${index}`,
          title: `Divergence: ${divergence.type}`,
          summary: divergence.recommendation,
          divergence: {
            type: divergence.type,
            ticketApproach: divergence.ticketApproach,
            codebaseConvention: divergence.codebaseConvention,
            recommendation: divergence.recommendation,
            severity: divergence.severity,
            affectedFiles: divergence.affectedFiles,
          },
          remindersSent: [],
        });
      });
    }

    if (items.length === 0) {
      throw new AppError(
        'NoApprovalItems',
        'No gaps or divergences are pending approval for this ticket.',
        409,
        'Run ticket parsing and divergence detection before creating an approval gate.',
      );
    }

    const expiresAt = new Date(Date.now() + APPROVAL_TTL_HOURS * 60 * 60 * 1000);

    const record = await getApprovalRequestModel().create({
      userId: String(user._id),
      ticketKey,
      workflowId,
      ticketIntentId: ticketIntentRecord._id.toString(),
      divergenceRecordId: divergenceRecord?._id.toString(),
      status: 'open',
      items,
      expiresAt,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      dataClassification: 'confidential',
    });

    await eventBus.publish(
      {
        type: 'APPROVAL_REQUESTED',
        payload: {
          ticketKey,
          workflowId,
          approvalId: record._id.toString(),
        },
        metadata: this.buildMetadata(user, ticketKey, workflowId),
      },
      { awaitHandlers: true },
    );

    await auditService.logSafe({
      resource: `approval_requests/${record._id.toString()}`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        ticketKey,
        workflowId,
        itemCount: items.length,
        expiresAt: toIso(expiresAt),
      },
    });

    return mapRequest(record);
  }

  async getRequest(user: UserDocument, requestId: string): Promise<ApprovalRequestResponse> {
    const record = await this.loadOwnedRequest(user, requestId);
    await this.applyLifecycle(record, user);
    const refreshed = await this.loadOwnedRequest(user, requestId);
    return mapRequest(refreshed);
  }

  async getStatus(user: UserDocument, requestId: string): Promise<ApprovalStatusResponse> {
    const record = await this.loadOwnedRequest(user, requestId);
    await this.applyLifecycle(record, user);
    const refreshed = await this.loadOwnedRequest(user, requestId);
    return buildStatus(refreshed);
  }

  async resolveItem(
    user: UserDocument,
    requestId: string,
    itemId: string,
    input: ApprovalResolveRequest,
  ): Promise<ApprovalRequestResponse> {
    const record = await this.loadOwnedRequest(user, requestId);
    await this.applyLifecycle(record, user);

    const fresh = await this.loadOwnedRequest(user, requestId);
    const item = fresh.items.find((entry) => entry.itemId === itemId);

    if (!item) {
      throw new AppError(
        'ApprovalItemNotFound',
        'Approval item was not found on this request.',
        404,
        'Use a valid itemId from the approval request.',
      );
    }

    if (item.status === 'expired') {
      throw new AppError(
        'ApprovalItemExpired',
        'Expired approval items cannot be resolved.',
        409,
        'Create a new approval request to re-initiate expired items.',
      );
    }

    if (item.status !== 'pending') {
      throw new AppError(
        'ApprovalItemAlreadyResolved',
        'This approval item has already been resolved.',
        409,
        'Choose a pending item or create a new approval request.',
      );
    }

    if (fresh.status === 'blocked') {
      throw new AppError(
        'ApprovalRequestBlocked',
        'This approval request is blocked due to expired items.',
        409,
        'Create a new approval request to continue.',
      );
    }

    const previousValue = { ...mapItem(item) };
    const resolvedAt = new Date().toISOString();
    const nextStatus =
      input.action === 'approve'
        ? 'approved'
        : input.action === 'reject'
          ? 'rejected'
          : 'modified';

    item.status = nextStatus;
    item.decision = {
      action: input.action,
      rationale: input.rationale,
      modifiedValue: input.modifiedValue,
      resolvedAt,
      resolvedBy: String(user._id),
    };

    fresh.status = computeRequestStatus(fresh.items);
    fresh.updatedBy = String(user._id);
    await fresh.save();

    await auditService.logSafe({
      resource: `approval_requests/${requestId}/items/${itemId}`,
      operation: 'update',
      actor: String(user._id),
      previousValue,
      newValue: {
        action: input.action,
        rationale: input.rationale,
        modifiedValue: input.modifiedValue,
        status: nextStatus,
        resolvedAt,
      },
    });

    await eventBus.publish(
      {
        type: 'APPROVAL_RESOLVED',
        payload: {
          ticketKey: fresh.ticketKey,
          workflowId: fresh.workflowId,
          approvalId: requestId,
          decision: input.action,
          itemId,
        },
        metadata: this.buildMetadata(user, fresh.ticketKey, fresh.workflowId),
      },
      { awaitHandlers: true },
    );

    if (fresh.status === 'cleared') {
      await eventBus.publish(
        {
          type: 'APPROVAL_RESOLVED',
          payload: {
            ticketKey: fresh.ticketKey,
            workflowId: fresh.workflowId,
            approvalId: requestId,
            decision: 'cleared',
          },
          metadata: this.buildMetadata(user, fresh.ticketKey, fresh.workflowId),
        },
        { awaitHandlers: true },
      );
    }

    return mapRequest(fresh);
  }

  async processExpirations(now = new Date()): Promise<number> {
    const openRequests = await getApprovalRequestModel()
      .find({ status: { $in: ['open', 'blocked'] } })
      .exec();

    let updated = 0;
    for (const request of openRequests) {
      const changed = await this.applyLifecycle(request, null, now);
      if (changed) {
        updated += 1;
      }
    }
    return updated;
  }

  private async loadOwnedRequest(user: UserDocument, requestId: string): Promise<ApprovalRequest> {
    const record = await getApprovalRequestModel().findById(requestId).exec();

    if (!record || record.userId !== String(user._id)) {
      throw new AppError(
        'ApprovalRequestNotFound',
        'Approval request was not found.',
        404,
        'Use a valid approval request id for the signed-in user.',
      );
    }

    return record;
  }

  private async applyLifecycle(
    record: ApprovalRequest,
    user: UserDocument | null,
    now = new Date(),
  ): Promise<boolean> {
    let changed = false;
    const actor = user ? String(user._id) : record.userId;
    const elapsedMs = now.getTime() - record.createdAt.getTime();
    const hoursElapsed = elapsedMs / (60 * 60 * 1000);
    const remainingMs = record.expiresAt.getTime() - now.getTime();
    const hoursRemaining = remainingMs / (60 * 60 * 1000);

    if (now >= record.expiresAt) {
      const expiredIds: string[] = [];
      for (const item of record.items) {
        if (item.status === 'pending') {
          item.status = 'expired';
          expiredIds.push(item.itemId);
          changed = true;
        }
      }

      if (expiredIds.length > 0) {
        record.status = 'blocked';
        record.updatedBy = actor;
        await record.save();

        await eventBus.publish(
          {
            type: 'APPROVAL_EXPIRED',
            payload: {
              ticketKey: record.ticketKey,
              workflowId: record.workflowId,
              approvalId: record._id.toString(),
              expiredItemIds: expiredIds,
            },
            metadata: this.buildMetadataFromIds(actor, record.ticketKey, record.workflowId),
          },
          { awaitHandlers: true },
        );
      } else {
        const nextStatus = computeRequestStatus(record.items);
        if (nextStatus !== record.status) {
          record.status = nextStatus;
          record.updatedBy = actor;
          await record.save();
          changed = true;
        }
      }

      return changed;
    }

    const reminderMarks: Array<{ mark: '24h' | '48h'; thresholdHoursRemaining: number }> = [
      { mark: '48h', thresholdHoursRemaining: 48 },
      { mark: '24h', thresholdHoursRemaining: 24 },
    ];

    // Reminders fire when remaining time first drops to/below 48h and 24h
    // (i.e. 24h and 48h after creation for a 72h TTL).
    for (const reminder of reminderMarks) {
      if (hoursRemaining > reminder.thresholdHoursRemaining) {
        continue;
      }
      if (hoursElapsed < APPROVAL_TTL_HOURS - reminder.thresholdHoursRemaining) {
        continue;
      }

      const pendingItems = record.items.filter((item) => item.status === 'pending');
      if (pendingItems.length === 0) {
        continue;
      }

      const needsReminder = pendingItems.some(
        (item) => !(item.remindersSent ?? []).includes(reminder.mark),
      );
      if (!needsReminder) {
        continue;
      }

      for (const item of pendingItems) {
        const marks = new Set(item.remindersSent ?? []);
        if (!marks.has(reminder.mark)) {
          marks.add(reminder.mark);
          item.remindersSent = Array.from(marks);
          changed = true;
        }
      }

      if (changed) {
        record.updatedBy = actor;
        await record.save();

        await eventBus.publish(
          {
            type: 'APPROVAL_REMINDER',
            payload: {
              ticketKey: record.ticketKey,
              workflowId: record.workflowId,
              approvalId: record._id.toString(),
              reminder: reminder.mark,
              pendingCount: pendingItems.length,
              expiresAt: toIso(record.expiresAt),
            },
            metadata: this.buildMetadataFromIds(actor, record.ticketKey, record.workflowId),
          },
          { awaitHandlers: true },
        );
      }
    }

    return changed;
  }

  private buildMetadata(user: UserDocument, ticketKey: string, workflowId: string) {
    return this.buildMetadataFromIds(String(user._id), ticketKey, workflowId);
  }

  private buildMetadataFromIds(actor: string, ticketKey: string, workflowId: string) {
    return {
      eventId: randomUUID(),
      correlationId: `ticket-${ticketKey}:${workflowId}`,
      actor,
      userId: actor,
      timestamp: new Date().toISOString(),
    };
  }
}

export const approvalGateService = new ApprovalGateService();

export type { ApprovalAction };
