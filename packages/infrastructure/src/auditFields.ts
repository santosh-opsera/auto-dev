import type { DataClassification } from '@autodev/shared-types';

/**
 * Audit + classification metadata applied to mutable MongoDB documents.
 * Used as the generic constraint for {@link BaseRepository}.
 */
export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  dataClassification: DataClassification;
}
