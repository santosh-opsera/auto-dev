import type { ConventionSettingsInput } from '@autodev/shared-types';
import {
  getConventionSettingsModel,
  type ConventionSettingsDocument,
  type ConventionSettingsRecord,
} from '../models/conventionSettingsModel.js';

export class ConventionSettingsRepository {
  async findActiveByUserId(userId: string): Promise<ConventionSettingsRecord | null> {
    return getConventionSettingsModel().findOne({ userId, isActive: true }).exec();
  }

  async findByIdForUser(id: string, userId: string): Promise<ConventionSettingsRecord | null> {
    return getConventionSettingsModel().findOne({ _id: id, userId }).exec();
  }

  async findHistoryByUserId(userId: string): Promise<ConventionSettingsRecord[]> {
    return getConventionSettingsModel().find({ userId }).sort({ version: -1 }).exec();
  }

  async hasActiveForUser(userId: string): Promise<boolean> {
    const count = await getConventionSettingsModel()
      .countDocuments({ userId, isActive: true })
      .exec();
    return count > 0;
  }

  async createInitial(
    userId: string,
    input: ConventionSettingsInput,
    actorId: string,
  ): Promise<ConventionSettingsRecord> {
    return getConventionSettingsModel().create({
      userId,
      version: 1,
      isActive: true,
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
      dataClassification: 'internal',
    });
  }

  async createNextVersion(
    userId: string,
    previous: ConventionSettingsRecord,
    input: ConventionSettingsInput,
    actorId: string,
  ): Promise<ConventionSettingsRecord> {
    await getConventionSettingsModel()
      .updateOne({ _id: previous._id }, { $set: { isActive: false, updatedBy: actorId } })
      .exec();

    return getConventionSettingsModel().create({
      userId,
      version: previous.version + 1,
      isActive: true,
      previousVersionId: String(previous._id),
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
      dataClassification: 'internal',
    });
  }
}

export const conventionSettingsRepository = new ConventionSettingsRepository();

export function toConventionSnapshot(
  record: ConventionSettingsDocument & { _id: unknown },
): Record<string, unknown> {
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
  };
}
