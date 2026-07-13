import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_HANDLING,
  RETENTION_POLICY_DAYS,
  dataClassificationSchema,
  getClassificationHandling,
  getRetentionPolicy,
  retentionPurgeResultSchema,
} from './dataClassification.js';
import {
  sampleClassificationDocuments,
  sampleClassificationHandling,
  sampleRetentionPolicies,
  sampleRetentionPurgeResult,
} from './fixtures/dataClassification.js';

describe('dataClassification', () => {
  it('accepts the four classification tiers', () => {
    for (const doc of sampleClassificationDocuments) {
      expect(dataClassificationSchema.parse(doc.dataClassification)).toBe(doc.dataClassification);
    }
  });

  it('requires Restricted encryption and Confidential field-level encryption', () => {
    expect(getClassificationHandling('restricted')).toMatchObject({
      encryptAtRest: true,
      fieldLevelEncryption: true,
      cryptographicErasure: true,
      maskPiiInLogs: true,
    });
    expect(getClassificationHandling('confidential')).toMatchObject({
      encryptAtRest: false,
      fieldLevelEncryption: true,
      cryptographicErasure: true,
      maskPiiInLogs: true,
    });
    expect(CLASSIFICATION_HANDLING.internal.maskPiiInLogs).toBe(true);
    expect(sampleClassificationHandling).toHaveLength(4);
  });

  it('defines retention: analysis 30d, AI logs 90d, audit 1y min', () => {
    expect(RETENTION_POLICY_DAYS.repo_analysis).toBe(30);
    expect(RETENTION_POLICY_DAYS.ai_interaction_logs).toBe(90);
    expect(RETENTION_POLICY_DAYS.audit_logs).toBe(365);

    const audit = getRetentionPolicy('audit_logs');
    expect(audit.minimumRetention).toBe(true);
    expect(getRetentionPolicy('repo_analysis').inactivityBased).toBe(true);
    expect(sampleRetentionPolicies.map((p) => p.category)).toEqual([
      'repo_analysis',
      'ai_interaction_logs',
      'audit_logs',
    ]);
  });

  it('validates retention purge result fixtures', () => {
    expect(retentionPurgeResultSchema.parse(sampleRetentionPurgeResult)).toEqual(
      sampleRetentionPurgeResult,
    );
  });
});
