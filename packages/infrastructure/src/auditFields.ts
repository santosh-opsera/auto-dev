import type { DataClassification } from '@autodev/shared-types';

/** Audit + classification metadata applied to mutable MongoDB documents. */
export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  dataClassification: DataClassification;
}
