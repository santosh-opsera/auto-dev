import { Schema, type SchemaDefinition } from 'mongoose';
import {
  CLASSIFICATION_HANDLING,
  DATA_CLASSIFICATIONS,
  type DataClassification,
  getClassificationHandling,
} from '@autodev/shared-types';
import type { AuditFields } from '@autodev/infrastructure';

export type { AuditFields };
export { DATA_CLASSIFICATIONS, type DataClassification, getClassificationHandling };

/**
 * Audit + classification metadata applied to every mutable MongoDB collection.
 *
 * Classification tiers (REQ-015 / WO-036):
 * - public: no encryption/masking requirements
 * - internal: PII masked in logs
 * - confidential: field-level AES-256-GCM + PII masking + cryptographic erasure
 * - restricted: AES-256-GCM at rest (tokens/keys) + field-level helpers + erasure
 *
 * Models should set `dataClassification` to the collection's default tier when creating docs.
 */
export const auditFieldDefinition = {
  createdBy: { type: String, required: false },
  updatedBy: { type: String, required: false },
  dataClassification: {
    type: String,
    enum: DATA_CLASSIFICATIONS,
    default: 'internal',
  },
} satisfies SchemaDefinition;

/** Default classification recommended per logical collection family. */
export const COLLECTION_DEFAULT_CLASSIFICATION = {
  users: 'confidential',
  sessions: 'restricted',
  auth_lockouts: 'internal',
  rate_limits: 'internal',
  oauth_tokens: 'restricted',
  audit_events: 'confidential',
  codebase_contexts: 'internal',
  github_repository_list_cache: 'internal',
  ai_interaction_logs: 'confidential',
  llm_cache: 'confidential',
  conventions: 'internal',
  prds: 'internal',
  workflows: 'internal',
  workflow_metrics: 'internal',
} as const satisfies Record<string, DataClassification>;

export function createBaseSchema(definition: SchemaDefinition): Schema {
  return new Schema(
    {
      ...definition,
      ...auditFieldDefinition,
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );
}

export function requiresRestrictedEncryption(classification: DataClassification): boolean {
  return CLASSIFICATION_HANDLING[classification].encryptAtRest;
}

export function requiresFieldLevelEncryption(classification: DataClassification): boolean {
  return CLASSIFICATION_HANDLING[classification].fieldLevelEncryption;
}

export function requiresCryptographicErasure(classification: DataClassification): boolean {
  return CLASSIFICATION_HANDLING[classification].cryptographicErasure;
}
