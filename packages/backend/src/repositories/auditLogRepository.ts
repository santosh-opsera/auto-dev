import type { FilterQuery } from 'mongoose';
import {
  getAuditLogModel,
  type AuditLogDocument,
  type AuditOperation,
} from '../models/auditLogModel.js';

export interface AuditLogAppendInput {
  actor: string;
  resource: string;
  operation: AuditOperation;
  previousValue?: unknown;
  newValue?: unknown;
  correlationId: string;
  ipAddress?: string;
}

export interface AuditLogQueryFilters {
  actor?: string;
  resource?: string;
  operation?: AuditOperation;
  from?: Date;
  to?: Date;
}

export interface AuditLogQueryResult {
  records: AuditLogDocument[];
  total: number;
}

export class AuditLogRepository {
  async append(input: AuditLogAppendInput): Promise<AuditLogDocument> {
    return getAuditLogModel().create({
      ...input,
      dataClassification: 'confidential',
    });
  }

  async findPaginated(
    filters: AuditLogQueryFilters,
    page: number,
    limit: number,
  ): Promise<AuditLogQueryResult> {
    const query: FilterQuery<AuditLogDocument> = {};

    if (filters.actor) {
      query.actor = filters.actor;
    }
    if (filters.resource) {
      query.resource = filters.resource;
    }
    if (filters.operation) {
      query.operation = filters.operation;
    }
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) {
        query.createdAt.$gte = filters.from;
      }
      if (filters.to) {
        query.createdAt.$lte = filters.to;
      }
    }

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      getAuditLogModel()
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      getAuditLogModel().countDocuments(query).exec(),
    ]);

    return { records, total };
  }
}

export const auditLogRepository = new AuditLogRepository();
