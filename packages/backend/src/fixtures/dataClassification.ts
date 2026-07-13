import type {
  DataClassification,
  RetentionPurgeResult,
} from '@autodev/shared-types';
import {
  sampleClassificationDocuments,
  samplePiiValues,
  sampleRetentionPolicies,
  sampleRetentionPurgeResult,
} from '@autodev/shared-types';

export {
  sampleClassificationDocuments,
  samplePiiValues,
  sampleRetentionPolicies,
  sampleRetentionPurgeResult,
};

export interface SampleEncryptedProfile {
  email: string;
  displayName: string;
  dataClassification: DataClassification;
}

export const sampleConfidentialProfile: SampleEncryptedProfile = {
  email: samplePiiValues.email,
  displayName: samplePiiValues.fullName,
  dataClassification: 'confidential',
};

export const sampleRestrictedToken = {
  label: 'github-oauth',
  plaintext: 'gho_example_restricted_token',
  dataClassification: 'restricted' as const,
};

export const sampleAiInteractionLogFixture = {
  userId: 'user-fixture-001',
  provider: 'openai',
  model: 'gpt-4o-mini',
  promptHash: 'abc123prompt',
  plaintextPayload: JSON.stringify({
    prompt: 'Summarize ticket AUTO-1 for Jane Doe <jane.doe@example.com>',
    response: 'Summary ready',
  }),
  dataClassification: 'confidential' as const,
};

export function createInMemoryRetentionStore(seed?: {
  analysis?: Array<{ id: string; updatedAt: Date; expiresAt: Date }>;
  aiLogs?: Array<{ id: string; createdAt: Date; expiresAt: Date }>;
  audit?: Array<{ id: string; createdAt: Date }>;
}): {
  analysis: Array<{ id: string; updatedAt: Date; expiresAt: Date }>;
  aiLogs: Array<{ id: string; createdAt: Date; expiresAt: Date }>;
  audit: Array<{ id: string; createdAt: Date }>;
  stores: {
    purgeRepoAnalysis(cutoff: Date): Promise<number>;
    purgeAiInteractionLogs(cutoff: Date): Promise<number>;
    purgeExpiredAuditLogs(cutoff: Date): Promise<number>;
  };
} {
  const analysis = [...(seed?.analysis ?? [])];
  const aiLogs = [...(seed?.aiLogs ?? [])];
  const audit = [...(seed?.audit ?? [])];

  return {
    analysis,
    aiLogs,
    audit,
    stores: {
      async purgeRepoAnalysis(cutoff) {
        const before = analysis.length;
        for (let i = analysis.length - 1; i >= 0; i -= 1) {
          const row = analysis[i]!;
          if (row.expiresAt <= cutoff || row.updatedAt <= cutoff) {
            analysis.splice(i, 1);
          }
        }
        return before - analysis.length;
      },
      async purgeAiInteractionLogs(cutoff) {
        const before = aiLogs.length;
        for (let i = aiLogs.length - 1; i >= 0; i -= 1) {
          const row = aiLogs[i]!;
          if (row.expiresAt <= cutoff || row.createdAt <= cutoff) {
            aiLogs.splice(i, 1);
          }
        }
        return before - aiLogs.length;
      },
      async purgeExpiredAuditLogs(cutoff) {
        const before = audit.length;
        for (let i = audit.length - 1; i >= 0; i -= 1) {
          const row = audit[i]!;
          if (row.createdAt <= cutoff) {
            audit.splice(i, 1);
          }
        }
        return before - audit.length;
      },
    },
  };
}

export function emptyPurgeResult(ranAt: string): RetentionPurgeResult {
  return {
    ranAt,
    purged: {
      repo_analysis: 0,
      ai_interaction_logs: 0,
      audit_logs: 0,
    },
  };
}
