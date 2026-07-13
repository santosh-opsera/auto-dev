import { z } from 'zod';
import { chunkStatusSchema } from './chunk.js';
import { workflowErrorSchema, workflowStateSchema } from './workflow.js';

export const EVENT_TYPES = [
  'TICKET_PARSED',
  'ANALYSIS_STARTED',
  'ANALYSIS_PROGRESS',
  'ANALYSIS_COMPLETED',
  'DIVERGENCE_DETECTED',
  'DIVERGENCE_NONE',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'APPROVAL_EXPIRED',
  'APPROVAL_REMINDER',
  'CONVENTION_UPDATED',
  'CHUNK_CREATED',
  'CHUNK_PROGRESS',
  'TESTING_STARTED',
  'TESTING_ITERATION',
  'TESTING_PASSED',
  'TESTING_FAILED',
  'PR_CREATED',
  'WORKFLOW_TRANSITIONED',
  'WORKFLOW_FAILED',
  'DEPENDENCY_UPDATE_AVAILABLE',
] as const;

export const eventTypeSchema = z.enum(EVENT_TYPES);

export type EventType = z.infer<typeof eventTypeSchema>;

export const eventMetadataSchema = z.object({
  eventId: z.string(),
  correlationId: z.string(),
  actor: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
});

export type EventMetadata = z.infer<typeof eventMetadataSchema>;

const ticketParsedPayloadSchema = z.object({
  ticketKey: z.string(),
  summary: z.string(),
});

const analysisStartedPayloadSchema = z.object({
  ticketKey: z.string().optional(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
});

const analysisProgressPayloadSchema = z.object({
  workflowId: z.string(),
  progressPercent: z.number().min(0).max(100),
  phase: z.string(),
});

const analysisCompletedPayloadSchema = z.object({
  ticketKey: z.string().optional(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
  findingsCount: z.number().int().nonnegative(),
});

const divergenceDetectedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  summary: z.string(),
  divergenceType: z.enum(['naming', 'pattern', 'architecture']).optional(),
  severity: z.enum(['critical', 'suggestion']).optional(),
});

const divergenceNonePayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
  summary: z.string(),
});

const approvalRequestedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
});

const approvalResolvedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
  decision: z.enum(['approve', 'reject', 'modify', 'cleared']),
  itemId: z.string().optional(),
});

const approvalExpiredPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
  expiredItemIds: z.array(z.string()),
});

const approvalReminderPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
  reminder: z.enum(['24h', '48h']),
  pendingCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
});

const conventionUpdatedPayloadSchema = z.object({
  settingsId: z.string(),
  version: z.number().int().positive(),
});

const chunkCreatedPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  prdId: z.string(),
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  status: chunkStatusSchema,
});

const chunkProgressPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'paused', 'skipped']),
  progressPercent: z.number().min(0).max(100),
});

const testingStartedPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  maxIterations: z.number().int().positive(),
  framework: z.string().min(1),
  testCount: z.number().int().nonnegative(),
});

const testingIterationPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  iteration: z.number().int().positive(),
  maxIterations: z.number().int().positive(),
  passed: z.boolean(),
  failedCount: z.number().int().nonnegative(),
  identifiedIssues: z.array(z.string()),
  fixesApplied: z.number().int().nonnegative(),
});

const testingPassedPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  iterationsUsed: z.number().int().nonnegative(),
  coveragePercent: z.number().min(0).max(100),
  passedCount: z.number().int().nonnegative(),
});

const testingFailedPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  iterationsUsed: z.number().int().positive(),
  maxIterations: z.number().int().positive(),
  failedCount: z.number().int().nonnegative(),
  rootCauseSummary: z.string().min(1),
});

const prCreatedPayloadSchema = z.object({
  workflowId: z.string(),
  prUrl: z.string().url(),
  prNumber: z.number().int().positive(),
  reviewers: z.array(z.string()),
  title: z.string().min(1),
});

const workflowTransitionedPayloadSchema = z.object({
  workflowId: z.string(),
  previousState: workflowStateSchema,
  newState: workflowStateSchema,
  trigger: z.string().min(1),
});

const workflowFailedPayloadSchema = z.object({
  workflowId: z.string(),
  previousState: workflowStateSchema,
  error: workflowErrorSchema,
});

const dependencyUpdateAvailablePayloadSchema = z.object({
  proposalId: z.string().min(1),
  packageName: z.string().min(1),
  currentVersion: z.string().min(1),
  proposedVersion: z.string().min(1),
  changelogLink: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  packagePath: z.string().min(1),
});

export const domainEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TICKET_PARSED'),
    payload: ticketParsedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_STARTED'),
    payload: analysisStartedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_PROGRESS'),
    payload: analysisProgressPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_COMPLETED'),
    payload: analysisCompletedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('DIVERGENCE_DETECTED'),
    payload: divergenceDetectedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('DIVERGENCE_NONE'),
    payload: divergenceNonePayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_REQUESTED'),
    payload: approvalRequestedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_RESOLVED'),
    payload: approvalResolvedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_EXPIRED'),
    payload: approvalExpiredPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_REMINDER'),
    payload: approvalReminderPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('CONVENTION_UPDATED'),
    payload: conventionUpdatedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('CHUNK_CREATED'),
    payload: chunkCreatedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('CHUNK_PROGRESS'),
    payload: chunkProgressPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('TESTING_STARTED'),
    payload: testingStartedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('TESTING_ITERATION'),
    payload: testingIterationPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('TESTING_PASSED'),
    payload: testingPassedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('TESTING_FAILED'),
    payload: testingFailedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('PR_CREATED'),
    payload: prCreatedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('WORKFLOW_TRANSITIONED'),
    payload: workflowTransitionedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('WORKFLOW_FAILED'),
    payload: workflowFailedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('DEPENDENCY_UPDATE_AVAILABLE'),
    payload: dependencyUpdateAvailablePayloadSchema,
    metadata: eventMetadataSchema,
  }),
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;

export type DomainEventByType<T extends EventType> = Extract<DomainEvent, { type: T }>;

export const publishEventOptionsSchema = z.object({
  awaitHandlers: z.boolean().optional(),
});

export type PublishEventOptions = z.infer<typeof publishEventOptionsSchema>;
