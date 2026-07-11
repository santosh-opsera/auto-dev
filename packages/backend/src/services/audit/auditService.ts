import type { AuditLogListResponse } from '@autodev/shared-types';
import {
  auditLogRepository,
  type AuditLogAppendInput,
  type AuditLogQueryFilters,
} from '../../repositories/auditLogRepository.js';
import type { AuditOperation } from '../../models/auditLogModel.js';
import { getRequestContext } from '../../utils/requestContext.js';
import { logger } from '../../utils/logger.js';

export interface AuditLogInput {
  resource: string;
  operation: AuditOperation;
  actor?: string;
  previousValue?: unknown;
  newValue?: unknown;
  correlationId?: string;
  ipAddress?: string;
}

export class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    const context = getRequestContext();
    const record: AuditLogAppendInput = {
      actor: input.actor ?? context?.actor ?? 'system',
      resource: input.resource,
      operation: input.operation,
      previousValue: input.previousValue,
      newValue: input.newValue,
      correlationId: input.correlationId ?? context?.correlationId ?? 'no-correlation-id',
      ipAddress: input.ipAddress,
    };

    await auditLogRepository.append(record);
  }

  async logSafe(input: AuditLogInput): Promise<void> {
    try {
      await this.log(input);
    } catch (error) {
      logger.error('Failed to write audit log record', {
        resource: input.resource,
        operation: input.operation,
        actor: 'system',
      });
      if (error instanceof Error) {
        logger.error(error.message, { resource: 'audit', operation: 'log' });
      }
    }
  }

  async query(
    filters: AuditLogQueryFilters,
    page: number,
    limit: number,
  ): Promise<AuditLogListResponse> {
    const { records, total } = await auditLogRepository.findPaginated(filters, page, limit);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      records: records.map((record) => ({
        id: String(record._id),
        actor: record.actor,
        timestamp: record.createdAt.toISOString(),
        resource: record.resource,
        operation: record.operation,
        previousValue: record.previousValue,
        newValue: record.newValue,
        correlationId: record.correlationId,
        ipAddress: record.ipAddress,
      })),
      page,
      limit,
      total,
      totalPages,
    };
  }
}

export const auditService = new AuditService();
