import { z } from 'zod';

/** Four-tier data classification used across MongoDB collections (REQ-015). */
export const DATA_CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;
export const dataClassificationSchema = z.enum(DATA_CLASSIFICATIONS);
export type DataClassification = z.infer<typeof dataClassificationSchema>;

/** Retention categories enforced by the daily purge job. */
export const RETENTION_CATEGORIES = ['repo_analysis', 'ai_interaction_logs', 'audit_logs'] as const;
export const retentionCategorySchema = z.enum(RETENTION_CATEGORIES);
export type RetentionCategory = z.infer<typeof retentionCategorySchema>;

export const RETENTION_POLICY_DAYS = {
  /** Cached repo analysis — purge after 30 days of inactivity. */
  repo_analysis: 30,
  /** AI prompts/responses — purge after 90 days. */
  ai_interaction_logs: 90,
  /** Audit logs — retain at least 1 year. */
  audit_logs: 365,
} as const satisfies Record<RetentionCategory, number>;

export const retentionPolicySchema = z.object({
  category: retentionCategorySchema,
  retentionDays: z.number().int().positive(),
  inactivityBased: z.boolean(),
  minimumRetention: z.boolean(),
});

export type RetentionPolicy = z.infer<typeof retentionPolicySchema>;

export const classificationHandlingSchema = z.object({
  classification: dataClassificationSchema,
  /** Restricted: AES-256-GCM at rest (OAuth tokens, API keys). */
  encryptAtRest: z.boolean(),
  /** Confidential: field-level AES-256-GCM in MongoDB. */
  fieldLevelEncryption: z.boolean(),
  /** Mask PII (email, names) in structured logs. */
  maskPiiInLogs: z.boolean(),
  /** Deletion uses cryptographic erasure (destroy per-record DEK). */
  cryptographicErasure: z.boolean(),
});

export type ClassificationHandling = z.infer<typeof classificationHandlingSchema>;

export const CLASSIFICATION_HANDLING: Record<DataClassification, ClassificationHandling> = {
  public: {
    classification: 'public',
    encryptAtRest: false,
    fieldLevelEncryption: false,
    maskPiiInLogs: false,
    cryptographicErasure: false,
  },
  internal: {
    classification: 'internal',
    encryptAtRest: false,
    fieldLevelEncryption: false,
    maskPiiInLogs: true,
    cryptographicErasure: false,
  },
  confidential: {
    classification: 'confidential',
    encryptAtRest: false,
    fieldLevelEncryption: true,
    maskPiiInLogs: true,
    cryptographicErasure: true,
  },
  restricted: {
    classification: 'restricted',
    encryptAtRest: true,
    fieldLevelEncryption: true,
    maskPiiInLogs: true,
    cryptographicErasure: true,
  },
};

export const retentionPurgeResultSchema = z.object({
  ranAt: z.string().datetime(),
  purged: z.object({
    repo_analysis: z.number().int().nonnegative(),
    ai_interaction_logs: z.number().int().nonnegative(),
    audit_logs: z.number().int().nonnegative(),
  }),
});

export type RetentionPurgeResult = z.infer<typeof retentionPurgeResultSchema>;

export function getRetentionPolicy(category: RetentionCategory): RetentionPolicy {
  return {
    category,
    retentionDays: RETENTION_POLICY_DAYS[category],
    inactivityBased: category === 'repo_analysis',
    minimumRetention: category === 'audit_logs',
  };
}

export function getClassificationHandling(
  classification: DataClassification,
): ClassificationHandling {
  return CLASSIFICATION_HANDLING[classification];
}
