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
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from './fixtures/events.js';

export {
  linkedIssueSchema,
  manualTicketRequestSchema,
  normalizedTicketSchema,
  sprintContextSchema,
  ticketAttachmentSchema,
  ticketKeyParamsSchema,
  ticketKeySchema,
  ticketResponseSchema,
  ticketSourceSchema,
  TICKET_KEY_PATTERN,
} from './tickets.js';

export type {
  ManualTicketRequest,
  NormalizedTicket,
  TicketResponse,
  TicketSource,
} from './tickets.js';

export {
  sampleJiraIssueResponse,
  sampleNormalizedTicket,
  samplePartialJiraIssueResponse,
} from './fixtures/tickets.js';

export {
  gapItemSchema,
  gapSeveritySchema,
  ticketIntentMetadataSchema,
  ticketIntentSchema,
  ticketParseResponseSchema,
} from './ticketIntent.js';

export type {
  GapItem,
  GapSeverity,
  TicketIntent,
  TicketParseResponse,
} from './ticketIntent.js';

export {
  sampleCriticalGaps,
  sampleStoryWithoutLinks,
  sampleTicketIntent,
  sampleTicketWithMissingAc,
  sampleVagueTicket,
  sampleWarningGaps,
} from './fixtures/ticketIntent.js';

export {
  githubRateLimitStatusSchema,
  githubRepositorySchema,
  repositoryConnectResponseSchema,
  connectedRepositoryListResponseSchema,
  repositoryConnectionSchema,
  repositoryFileParamsSchema,
  repositoryFileResponseSchema,
  repositoryListResponseSchema,
  repositoryNameSchema,
  repositoryOwnerSchema,
  repositoryParamsSchema,
  repositoryTreeEntrySchema,
  repositoryTreeResponseSchema,
} from './repositories.js';

export type {
  GitHubRateLimitStatus,
  GitHubRepository,
  RepositoryConnectResponse,
  ConnectedRepositoryListResponse,
  RepositoryConnection,
  RepositoryFileResponse,
  RepositoryListResponse,
  RepositoryTreeEntry,
  RepositoryTreeResponse,
} from './repositories.js';

export {
  mockGitHubApiFileResponse,
  mockGitHubApiRepositoryResponse,
  mockGitHubApiTreeResponse,
  sampleGitHubRepositories,
  sampleRepositoryFile,
  sampleRepositoryTree,
} from './fixtures/repositories.js';

export {
  architecturalLayerSchema,
  codebaseAnalysisRequestSchema,
  codebaseAnalysisResponseSchema,
  codebaseContextSchema,
  dependencyEdgeSchema,
  designPatternSchema,
  fileStructureNodeSchema,
  namingConventionSchema,
} from './codebaseContext.js';

export type {
  ArchitecturalLayer,
  CodebaseAnalysisRequest,
  CodebaseAnalysisResponse,
  CodebaseContext,
  DependencyEdge,
  DesignPattern,
  FileStructureNode,
  NamingConvention,
} from './codebaseContext.js';

export {
  sampleExpectedSmallContext,
  sampleFileStructureMap,
  sampleMediumRepoTree,
  sampleSmallRepoFiles,
  sampleSmallRepoTree,
} from './fixtures/codebaseContext.js';

export {
  divergenceDetectionRequestSchema,
  divergenceDetectionResponseSchema,
  divergenceSchema,
  divergenceSeveritySchema,
  divergenceTypeSchema,
} from './divergence.js';

export type {
  Divergence,
  DivergenceDetectionRequest,
  DivergenceDetectionResponse,
  DivergenceSeverity,
  DivergenceType,
} from './divergence.js';

export {
  sampleAlignedTicketIntent,
  sampleArchitectureConflictTicketIntent,
  sampleAutoDevLikeContext,
  sampleExpectedArchitectureDivergence,
  sampleExpectedNamingDivergence,
  sampleExpectedPatternDivergence,
  sampleNamingConflictTicketIntent,
  samplePatternConflictTicketIntent,
} from './fixtures/divergence.js';

export {
  APPROVAL_REMINDER_HOURS,
  APPROVAL_TTL_HOURS,
  approvalActionSchema,
  approvalCreateRequestSchema,
  approvalDecisionSchema,
  approvalItemParamsSchema,
  approvalItemSchema,
  approvalItemStatusSchema,
  approvalItemTypeSchema,
  approvalReminderMarkSchema,
  approvalRequestIdParamsSchema,
  approvalRequestResponseSchema,
  approvalRequestStatusSchema,
  approvalResolveRequestSchema,
  approvalStatusResponseSchema,
} from './approval.js';

export type {
  ApprovalAction,
  ApprovalCreateRequest,
  ApprovalDecision,
  ApprovalItem,
  ApprovalItemStatus,
  ApprovalItemType,
  ApprovalReminderMark,
  ApprovalRequestResponse,
  ApprovalRequestStatus,
  ApprovalResolveRequest,
  ApprovalStatusResponse,
} from './approval.js';

export {
  sampleApprovalRequestExpired,
  sampleApprovalRequestMixed,
  sampleApprovalRequestPending,
} from './fixtures/approval.js';

export {
  llmChatMessageSchema,
  llmChatRequestSchema,
  llmChatRoleSchema,
  llmCompleteRequestSchema,
  llmCompletionResponseSchema,
  llmEmbedRequestSchema,
  llmEmbeddingResponseSchema,
  llmProviderSchema,
  llmRequestOptionsSchema,
  llmUsageSchema,
} from './llm.js';

export type {
  LlmChatMessage,
  LlmChatRequest,
  LlmChatRole,
  LlmCompleteRequest,
  LlmCompletionResponse,
  LlmEmbedRequest,
  LlmEmbeddingResponse,
  LlmProvider,
  LlmRequestOptions,
  LlmUsage,
} from './llm.js';

export {
  sampleDivergenceReasoningPrompt,
  sampleLlmChatMessages,
  sampleLlmCompletionResponse,
  sampleLlmEmbeddingResponse,
} from './fixtures/llm.js';

export {
  isPausableWorkflowState,
  isTerminalWorkflowState,
  PAUSABLE_WORKFLOW_STATES,
  TERMINAL_WORKFLOW_STATES,
  WORKFLOW_STATES,
  workflowCreateRequestSchema,
  workflowErrorSchema,
  workflowFailRequestSchema,
  workflowIdParamsSchema,
  workflowListQuerySchema,
  workflowListResponseSchema,
  workflowProgressSchema,
  workflowResponseSchema,
  workflowStateSchema,
  workflowTransitionRecordSchema,
  workflowTransitionRequestSchema,
} from './workflow.js';

export type {
  PausableWorkflowState,
  TerminalWorkflowState,
  WorkflowCreateRequest,
  WorkflowError,
  WorkflowFailRequest,
  WorkflowListQuery,
  WorkflowListResponse,
  WorkflowProgress,
  WorkflowResponse,
  WorkflowState,
  WorkflowTransitionRecord,
  WorkflowTransitionRequest,
} from './workflow.js';

export {
  sampleFailedHistory,
  sampleHappyPathHistory,
  samplePausedHistory,
  sampleWorkflowCompleted,
  sampleWorkflowCreated,
  sampleWorkflowFailed,
  sampleWorkflowPaused,
} from './fixtures/workflow.js';

export {
  PRD_GENERATION_TIMEOUT_MS,
  PRD_SECTION_KEYS,
  PRD_SECTION_LABELS,
  encodePrdSections,
  escapeHtml,
  formatPrdSectionValue,
  prdCodebaseContextSummarySchema,
  prdCreateVersionRequestSchema,
  prdGenerateRequestSchema,
  prdIdParamsSchema,
  prdListResponseSchema,
  prdRejectRequestSchema,
  prdResponseSchema,
  prdSectionsSchema,
  prdStatusSchema,
} from './prd.js';

export type {
  PrdCodebaseContextSummary,
  PrdCreateVersionRequest,
  PrdGenerateRequest,
  PrdListResponse,
  PrdRejectRequest,
  PrdResponse,
  PrdSectionKey,
  PrdSections,
  PrdStatus,
} from './prd.js';

export {
  sampleApprovedPrd,
  sampleExpectedPrdResponse,
  samplePrdLlmJsonResponse,
  samplePrdSections,
  samplePrdVersionTwo,
  samplePrdWithXssAttempt,
  sampleRejectedPrd,
} from './fixtures/prd.js';
