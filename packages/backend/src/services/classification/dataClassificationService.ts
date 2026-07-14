import type {
  ClassificationHandling,
  DataClassification,
  RetentionCategory,
  RetentionPolicy,
} from '@autodev/shared-types';
import {
  getClassificationHandling,
  getRetentionPolicy,
} from '@autodev/shared-types';
import {
  COLLECTION_DEFAULT_CLASSIFICATION,
  requiresCryptographicErasure,
  requiresFieldLevelEncryption,
  requiresRestrictedEncryption,
} from '../../database/baseSchema.js';
import {
  cryptographicallyErase,
  decryptConfidentialField,
  decryptConfidentialFields,
  decryptRestricted,
  decryptWithPerRecordDek,
  encryptConfidentialField,
  encryptConfidentialFields,
  encryptRestricted,
  encryptWithPerRecordDek,
  type WrappedEncryptedPayload,
} from '@autodev/infrastructure';
import { maskEmail, maskName, maskPiiInText } from '../../lib/piiMasking.js';
import { runRetentionPurge, startDailyRetentionJob } from './retentionJob.js';

/**
 * Facade for data classification enforcement: encryption, masking, erasure, retention.
 */
export const dataClassificationService = {
  getHandling(classification: DataClassification): ClassificationHandling {
    return getClassificationHandling(classification);
  },

  getRetentionPolicy(category: RetentionCategory): RetentionPolicy {
    return getRetentionPolicy(category);
  },

  defaultClassificationFor(collection: keyof typeof COLLECTION_DEFAULT_CLASSIFICATION): DataClassification {
    return COLLECTION_DEFAULT_CLASSIFICATION[collection];
  },

  requiresRestrictedEncryption,
  requiresFieldLevelEncryption,
  requiresCryptographicErasure,

  encryptRestricted,
  decryptRestricted,
  encryptConfidentialField,
  decryptConfidentialField,
  encryptConfidentialFields,
  decryptConfidentialFields,

  encryptWithPerRecordDek,
  decryptWithPerRecordDek,
  cryptographicallyErase,

  maskEmail,
  maskName,
  maskPiiInText,

  runRetentionPurge,
  startDailyRetentionJob,
};

export type { WrappedEncryptedPayload };
