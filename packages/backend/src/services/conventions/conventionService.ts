import type {
  ConventionHistoryResponse,
  ConventionSettingsInput,
  ConventionSettingsResponse,
} from '@autodev/shared-types';
import {
  conventionSettingsRepository,
  toConventionSnapshot,
  type ConventionSettingsRecord,
} from '../../repositories/conventionSettingsRepository.js';
import { auditService } from '../audit/auditService.js';
import { AppError } from '../../utils/errors.js';
import {
  conventionTemplateVariables,
  defaultConventionTemplates,
} from '../../fixtures/conventionDefaults.js';

function toResponse(record: ConventionSettingsRecord): ConventionSettingsResponse {
  return {
    id: String(record._id),
    userId: record.userId,
    version: record.version,
    isActive: record.isActive,
    previousVersionId: record.previousVersionId,
    commitMessageFormat: record.commitMessageFormat,
    branchNameTemplate: record.branchNameTemplate,
    branchNamingPattern: record.branchNamingPattern,
    prTitleTemplate: record.prTitleTemplate,
    prDescriptionTemplate: record.prDescriptionTemplate,
    reviewerAssignmentRules: record.reviewerAssignmentRules,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ConventionService {
  getDefaults() {
    return {
      templates: defaultConventionTemplates,
      availableVariables: conventionTemplateVariables,
    };
  }

  async getActive(userId: string): Promise<ConventionSettingsResponse | null> {
    const record = await conventionSettingsRepository.findActiveByUserId(userId);
    return record ? toResponse(record) : null;
  }

  async getHistory(userId: string): Promise<ConventionHistoryResponse> {
    const records = await conventionSettingsRepository.findHistoryByUserId(userId);
    return {
      versions: records.map(toResponse),
    };
  }

  async create(
    userId: string,
    input: ConventionSettingsInput,
    actorId: string,
  ): Promise<ConventionSettingsResponse> {
    const existing = await conventionSettingsRepository.findActiveByUserId(userId);
    if (existing) {
      throw new AppError(
        'Conflict',
        'Convention settings already exist for this user.',
        409,
        'Use PUT /api/v1/conventions/:id to create a new version.',
      );
    }

    const record = await conventionSettingsRepository.createInitial(userId, input, actorId);
    const response = toResponse(record);

    await auditService.logSafe({
      resource: `convention_settings/${response.id}`,
      operation: 'create',
      actor: actorId,
      newValue: toConventionSnapshot(record),
    });

    return response;
  }

  async createVersion(
    userId: string,
    settingsId: string,
    input: ConventionSettingsInput,
    actorId: string,
  ): Promise<ConventionSettingsResponse> {
    const previous = await conventionSettingsRepository.findByIdForUser(settingsId, userId);
    if (!previous) {
      throw new AppError(
        'NotFound',
        'Convention settings not found.',
        404,
        'Verify the settings id and try again.',
      );
    }

    if (!previous.isActive) {
      throw new AppError(
        'Conflict',
        'Only the active convention settings version can be updated.',
        409,
        'Create a new version from the current active settings.',
      );
    }

    const record = await conventionSettingsRepository.createNextVersion(
      userId,
      previous,
      input,
      actorId,
    );
    const response = toResponse(record);

    await auditService.logSafe({
      resource: `convention_settings/${response.id}`,
      operation: 'update',
      actor: actorId,
      previousValue: toConventionSnapshot(previous),
      newValue: toConventionSnapshot(record),
    });

    return response;
  }
}

export const conventionService = new ConventionService();
