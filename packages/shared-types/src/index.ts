import { z } from 'zod';

export const healthCheckSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;

export const userFixtureSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(['user', 'admin']),
  createdAt: z.string().datetime(),
});

export type UserFixture = z.infer<typeof userFixtureSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  supportReferenceId: z.string(),
  suggestedAction: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const fieldValidationErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldValidationError = z.infer<typeof fieldValidationErrorSchema>;

export const validationErrorResponseSchema = errorResponseSchema.extend({
  fields: z.array(fieldValidationErrorSchema),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export const dbHealthConnectedSchema = z.object({
  status: z.literal('connected'),
  latencyMs: z.number().nonnegative(),
  database: z.string().optional(),
});

export const dbHealthDisconnectedSchema = z.object({
  status: z.literal('disconnected'),
  error: z.string(),
});

export type DbHealthConnected = z.infer<typeof dbHealthConnectedSchema>;
export type DbHealthDisconnected = z.infer<typeof dbHealthDisconnectedSchema>;

export const auditDocumentSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
});

export const auditOperationSchema = z.enum([
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'login_failed',
  'token_refresh',
  'lockout',
]);

export type AuditOperation = z.infer<typeof auditOperationSchema>;

export const auditLogRecordSchema = z.object({
  id: z.string(),
  actor: z.string(),
  timestamp: z.string().datetime(),
  resource: z.string(),
  operation: auditOperationSchema,
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  correlationId: z.string(),
  ipAddress: z.string().optional(),
});

export type AuditLogRecord = z.infer<typeof auditLogRecordSchema>;

export const auditLogListQuerySchema = z.object({
  resource: z.string().optional(),
  actor: z.string().optional(),
  operation: auditOperationSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

export const auditLogListResponseSchema = z.object({
  records: z.array(auditLogRecordSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;

export {
  GITHUB_USERNAME_REGEX,
  branchNamingPatternSchema,
  conventionDefaultsResponseSchema,
  conventionHistoryResponseSchema,
  conventionSettingsInputSchema,
  conventionSettingsListResponseSchema,
  conventionSettingsParamsSchema,
  conventionSettingsResponseSchema,
  githubUsernameSchema,
  isValidRegexPattern,
  reviewerAssignmentRulesSchema,
} from './conventions.js';

export type {
  ConventionDefaultsResponse,
  ConventionHistoryResponse,
  ConventionSettingsInput,
  ConventionSettingsListResponse,
  ConventionSettingsResponse,
} from './conventions.js';

export {
  domainEventSchema,
  eventMetadataSchema,
  eventTypeSchema,
  EVENT_TYPES,
  publishEventOptionsSchema,
} from './events.js';

export type {
  DomainEvent,
  DomainEventByType,
  EventMetadata,
  EventType,
  PublishEventOptions,
} from './events.js';

export {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleEventMetadata,
  sampleTicketParsedEvent,
} from './fixtures/events.js';
