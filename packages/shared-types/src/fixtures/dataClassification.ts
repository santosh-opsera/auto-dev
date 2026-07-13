import type {
  ClassificationHandling,
  DataClassification,
  RetentionPolicy,
  RetentionPurgeResult,
} from '../dataClassification.js';
import {
  CLASSIFICATION_HANDLING,
  getRetentionPolicy,
} from '../dataClassification.js';

/** Sample documents at each classification tier for tests and seeds. */
export const sampleClassificationDocuments: Array<{
  id: string;
  label: string;
  dataClassification: DataClassification;
  sensitiveValue: string;
}> = [
  {
    id: 'class-public-001',
    label: 'Public health status',
    dataClassification: 'public',
    sensitiveValue: 'ok',
  },
  {
    id: 'class-internal-001',
    label: 'Internal convention settings',
    dataClassification: 'internal',
    sensitiveValue: 'branch/{ticketKey}',
  },
  {
    id: 'class-confidential-001',
    label: 'User profile email',
    dataClassification: 'confidential',
    sensitiveValue: 'alex.dev@example.com',
  },
  {
    id: 'class-restricted-001',
    label: 'OAuth access token',
    dataClassification: 'restricted',
    sensitiveValue: 'gho_restricted_token_example',
  },
];

export const samplePiiValues = {
  email: 'jane.doe@example.com',
  maskedEmail: 'j***@***.com',
  fullName: 'Jane Doe',
  maskedName: 'J*** D***',
  multiPartName: 'Jane Marie Doe',
  maskedMultiPartName: 'J*** M*** D***',
  logMessage: 'User jane.doe@example.com (Jane Doe) updated preferences',
};

export const sampleRetentionPolicies: RetentionPolicy[] = [
  getRetentionPolicy('repo_analysis'),
  getRetentionPolicy('ai_interaction_logs'),
  getRetentionPolicy('audit_logs'),
];

export const sampleClassificationHandling: ClassificationHandling[] = [
  CLASSIFICATION_HANDLING.public,
  CLASSIFICATION_HANDLING.internal,
  CLASSIFICATION_HANDLING.confidential,
  CLASSIFICATION_HANDLING.restricted,
];

export const sampleRetentionPurgeResult: RetentionPurgeResult = {
  ranAt: '2026-07-13T00:00:00.000Z',
  purged: {
    repo_analysis: 2,
    ai_interaction_logs: 5,
    audit_logs: 0,
  },
};
