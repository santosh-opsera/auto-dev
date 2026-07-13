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
  branchNameTemplateSchema,
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
  MAX_REGEXP_PATTERN_LENGTH,
  describeRegExpSafetyIssue,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
} from './safeRegExp.js';

export type { RegExpSafetyIssue } from './safeRegExp.js';

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
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleConventionValidationEvent,
  sampleDependencyUpdateAvailableEvent,
  sampleDeploymentCompletedEvent,
  sampleDeploymentFailedEvent,
  sampleDeploymentStartedEvent,
  sampleEventMetadata,
  sampleQaChangesRequestedEvent,
  sampleQaHandoffApprovedEvent,
  sampleQaHandoffReadyEvent,
  sampleTestingFailedEvent,
  sampleTestingIterationEvent,
  sampleTestingPassedEvent,
  sampleTestingStartedEvent,
  samplePrCreatedEvent,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from './fixtures/events.js';

export {
  CONVENTION_ARTIFACT_TYPES,
  METRICS_PERIODS,
  aggregatedMetricsResponseSchema,
  buildRateSummary,
  calculateAverageMs,
  calculateMedianMs,
  calculateRatePercent,
  conventionArtifactTypeSchema,
  durationSummarySchema,
  metricsPeriodDays,
  metricsPeriodSchema,
  metricsQuerySchema,
  periodWindow,
  rateSummarySchema,
  resolveStageTimings,
  workflowMetricsParamsSchema,
  workflowMetricsResponseSchema,
  workflowStageTimingSchema,
} from './metrics.js';

export type {
  AggregatedMetricsResponse,
  ConventionArtifactType,
  DurationSummary,
  MetricsPeriod,
  MetricsQuery,
  RateSummary,
  WorkflowMetricsParams,
  WorkflowMetricsResponse,
  WorkflowStageTiming,
} from './metrics.js';

export {
  expectedAggregatedMetrics30d,
  expectedWorkflowAMetrics,
  metricsWorkflowAId,
  metricsWorkflowBId,
  sampleMetricsDomainEvents,
  sampleMetricsWorkflowAEvents,
  sampleMetricsWorkflowBEvents,
} from './fixtures/metrics.js';

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

export type {
  PausableWorkflowState,
  TerminalWorkflowState,
  WorkflowCreateRequest,
  WorkflowError,
  WorkflowFailRequest,
  WorkflowListQuery,
  WorkflowListResponse,
  WorkflowProgress,
  WorkflowPullRequest,
  WorkflowResponse,
  WorkflowState,
  WorkflowTransitionRecord,
  WorkflowTransitionRequest,
} from './workflow.js';

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
  workflowPullRequestSchema,
  workflowResponseSchema,
  workflowStateSchema,
  workflowTransitionRecordSchema,
  workflowTransitionRequestSchema,
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

export {
  BRANCH_GIT_STATUSES,
  CHUNK_COMPLEXITIES,
  CHUNK_STATUSES,
  CHUNK_STATUS_TRANSITIONS,
  branchGitStatusSchema,
  canTransitionChunkStatus,
  chunkComplexitySchema,
  chunkDecomposeRequestSchema,
  chunkDecompositionDraftSchema,
  chunkListResponseSchema,
  chunkScopeSchema,
  chunkStatusSchema,
  chunkStatusUpdateRequestSchema,
  implementationChunkResponseSchema,
  workflowChunkIdParamsSchema,
  workflowChunkParamsSchema,
} from './chunk.js';

export type {
  BranchGitStatus,
  ChunkComplexity,
  ChunkDecomposeRequest,
  ChunkDecompositionDraft,
  ChunkListResponse,
  ChunkScope,
  ChunkStatus,
  ChunkStatusUpdateRequest,
  ImplementationChunkResponse,
} from './chunk.js';

export {
  sampleChunkDecompositionDraft,
  sampleChunkLlmJsonResponse,
  sampleExpectedChunkDecomposition,
  sampleImplementationChunks,
} from './fixtures/chunk.js';

export {
  CURSOR_CONTEXT_SCHEMA_VERSION,
  cursorApprovedPrdSnapshotSchema,
  cursorChunkSpecSchema,
  cursorContextDocumentSchema,
  cursorContextResponseSchema,
  cursorConventionSnapshotSchema,
  cursorConventionValidationSchema,
  cursorDeliveryAckSchema,
  cursorDeliveryStatusSchema,
  cursorExecuteRequestSchema,
  cursorExecuteResponseSchema,
  cursorFileChangeActionSchema,
  cursorFileChangeSchema,
  cursorImplementationResultSchema,
  cursorPrdSourceSchema,
  cursorResultValidationSchema,
  cursorResultsSubmitRequestSchema,
  cursorResultsSubmitResponseSchema,
  cursorScopeValidationSchema,
} from './cursorBridge.js';

export type {
  CursorApprovedPrdSnapshot,
  CursorChunkSpec,
  CursorContextDocument,
  CursorContextResponse,
  CursorConventionSnapshot,
  CursorConventionValidation,
  CursorDeliveryAck,
  CursorDeliveryStatus,
  CursorExecuteRequest,
  CursorExecuteResponse,
  CursorFileChange,
  CursorFileChangeAction,
  CursorImplementationResult,
  CursorPrdSource,
  CursorResultValidation,
  CursorResultsSubmitRequest,
  CursorResultsSubmitResponse,
  CursorScopeValidation,
} from './cursorBridge.js';

export {
  sampleCursorContextDocument,
  sampleCursorConventions,
  sampleCursorImplementationResult,
  sampleCursorImplementationResultBadConventions,
  sampleCursorImplementationResultOutOfScope,
} from './fixtures/cursorBridge.js';

export {
  branchNamePreviewResponseSchema,
  branchPreviewQuerySchema,
  chunkBranchResponseSchema,
  chunkCommitResponseSchema,
  commitChunkFileSchema,
  commitChunkRequestSchema,
  commitMessagePreviewResponseSchema,
  commitPreviewQuerySchema,
  createChunkBranchRequestSchema,
} from './branchCommit.js';

export type {
  BranchNamePreviewResponse,
  BranchPreviewQuery,
  ChunkBranchResponse,
  ChunkCommitResponse,
  CommitChunkFile,
  CommitChunkRequest,
  CommitMessagePreviewResponse,
  CommitPreviewQuery,
  CreateChunkBranchRequest,
} from './branchCommit.js';

export {
  mockGitHubCreatedBlobResponse,
  mockGitHubCreatedCommitResponse,
  mockGitHubCreatedTreeResponse,
  mockGitHubGitCommitResponse,
  mockGitHubGitRefResponse,
  sampleBranchCommitConventions,
  sampleBranchNamePreview,
  sampleChunkBranchResponse,
  sampleChunkCommitResponse,
  sampleCommitChunkRequest,
  sampleCommitMessagePreview,
  sampleCreateBranchRequest,
  sampleExpectedBranchName,
  sampleExpectedCommitMessage,
} from './fixtures/branchCommit.js';

export {
  DEFAULT_MAX_TEST_FIX_ITERATIONS,
  TEST_FIX_HARD_MAX_ITERATIONS,
  TEST_FRAMEWORKS,
  TEST_KINDS,
  TEST_CASE_STATUSES,
  TEST_REPORT_STATUSES,
  appliedFixSchema,
  bugFixDraftSchema,
  chunkTestReportResponseSchema,
  chunkTestReportSchema,
  chunkTestRequestSchema,
  chunkTestResponseSchema,
  clampMaxTestFixIterations,
  coverageMetricsSchema,
  failureReportSchema,
  generatedTestSchema,
  generatedTestsDraftSchema,
  testCaseResultSchema,
  testCaseStatusSchema,
  testFrameworkSchema,
  testIterationLogSchema,
  testKindSchema,
  testReportStatusSchema,
  testRunResultSchema,
} from './testFix.js';

export type {
  AppliedFix,
  BugFixDraft,
  ChunkTestReport,
  ChunkTestReportResponse,
  ChunkTestRequest,
  ChunkTestResponse,
  CoverageMetrics,
  FailureReport,
  GeneratedTest,
  GeneratedTestsDraft,
  TestCaseResult,
  TestCaseStatus,
  TestFramework,
  TestIterationLog,
  TestKind,
  TestReportStatus,
  TestRunResult,
} from './testFix.js';

export {
  sampleBuggySourceFiles,
  sampleChunkTestReportFailed,
  sampleChunkTestReportPassed,
  sampleFixedSourceFiles,
  sampleGeneratedTestsDraft,
  sampleGeneratedTestsLlmJson,
  samplePartialBugFixDraft,
  samplePartialBugFixLlmJson,
  sampleSuccessfulBugFixDraft,
  sampleSuccessfulBugFixLlmJson,
} from './fixtures/testFix.js';

export {
  LABEL_BY_CHANGE_TYPE,
  PR_CHANGE_TYPES,
  createPullRequestRequestSchema,
  labelForChangeType,
  prChangeTypeSchema,
  pullRequestResponseSchema,
} from './pullRequest.js';

export type {
  CreatePullRequestRequest,
  PrChangeType,
  PullRequestResponse,
} from './pullRequest.js';

export {
  mockGitHubCodeOwnersFile,
  mockGitHubPullRequestResponse,
  sampleCreatePullRequestRequest,
  sampleExpectedGitHubCreatePullRequestPayload,
  sampleManualListReviewers,
  samplePrCreationConventions,
  samplePullRequestResponse,
  sampleRoundRobinReviewers,
} from './fixtures/pullRequest.js';

export {
  AUDIT_SEVERITIES,
  AUDIT_SEVERITY_RANK,
  DEFAULT_AUDIT_SEVERITY_THRESHOLD,
  PACKAGE_PROPOSAL_STATUSES,
  SEMVER_BUMP_TYPES,
  applySemverBump,
  auditSeveritySchema,
  isPublishablePackageJson,
  packageConfirmRequestSchema,
  packageDetectRequestSchema,
  packageDetectResponseSchema,
  packageJsonManifestSchema,
  packageProposalIdParamsSchema,
  packageProposalStatusSchema,
  packagePublishProposalSchema,
  packagePublishRequestSchema,
  packageSnapshotSchema,
  semverBumpTypeSchema,
  severityMeetsThreshold,
  allowListValidationSchema,
  versionBumpAnalysisSchema,
  vulnerabilityFindingSchema,
  vulnerabilityScanResultSchema,
} from './packages.js';

export type {
  AllowListValidation,
  AuditSeverity,
  PackageConfirmRequest,
  PackageDetectRequest,
  PackageDetectResponse,
  PackageJsonManifest,
  PackageProposalIdParams,
  PackageProposalStatus,
  PackagePublishProposal,
  PackagePublishRequest,
  PackageSnapshot,
  SemverBumpType,
  VersionBumpAnalysis,
  VulnerabilityFinding,
  VulnerabilityScanResult,
} from './packages.js';

export {
  sampleChangedFilesBreaking,
  sampleChangedFilesFeature,
  sampleChangedFilesFix,
  sampleDetectRequest,
  sampleNonLibraryPackageJson,
  sampleNpmAuditClean,
  sampleNpmAuditCritical,
  sampleNpmAuditWithHigh,
  sampleNpmignore,
  samplePackagePublishProposal,
  samplePackageSnapshotBlocked,
  samplePackageSnapshotPrivate,
  samplePackageSnapshotPublishable,
  samplePrivateAppPackageJson,
  samplePublishablePackageJson,
  samplePublishableRootPackageJson,
  sampleVulnerabilityScanBlocked,
  sampleVulnerabilityScanClean,
} from './fixtures/packages.js';

export {
  DEPENDENCY_FIELDS,
  DEPENDENCY_UPDATE_PROPOSAL_STATUSES,
  buildChangelogLink,
  consumerPackageJsonSchema,
  dependencyConsumerSchema,
  dependencyFieldSchema,
  dependencyGraphSchema,
  dependencyScanRequestSchema,
  dependencyScanResponseSchema,
  dependencyUpdateProposalIdParamsSchema,
  dependencyUpdateProposalListResponseSchema,
  dependencyUpdateProposalSchema,
  dependencyUpdateProposalStatusSchema,
  isVersionOutdated,
  outdatedDependenciesResponseSchema,
  packageBumpNotifyRequestSchema,
  packageBumpNotifyResponseSchema,
  packageConsumersResponseSchema,
  packageDependencyNodeSchema,
  packageNameParamsSchema,
  parseComparableSemver,
  repositoryDependencySnapshotSchema,
  repositoryPackageJsonFileSchema,
} from './dependencies.js';

export type {
  ConsumerPackageJson,
  DependencyConsumer,
  DependencyField,
  DependencyGraph,
  DependencyScanRequest,
  DependencyScanResponse,
  DependencyUpdateProposal,
  DependencyUpdateProposalIdParams,
  DependencyUpdateProposalListResponse,
  DependencyUpdateProposalStatus,
  OutdatedDependenciesResponse,
  PackageBumpNotifyRequest,
  PackageBumpNotifyResponse,
  PackageConsumersResponse,
  PackageDependencyNode,
  PackageNameParams,
  RepositoryDependencySnapshot,
  RepositoryPackageJsonFile,
} from './dependencies.js';

export {
  sampleConsumerApiPackageJson,
  sampleConsumerApiRepoSnapshot,
  sampleConsumerApiWorkspacePackageJson,
  sampleConsumerWebAppPackageJson,
  sampleConsumerWebRepoSnapshot,
  sampleDependencyGraph,
  sampleDependencyScanRequest,
  sampleDependencyUpdateProposal,
  samplePackageBumpNotifyRequest,
  sampleProducerPackageJson,
  sampleProducerRepoSnapshot,
  sampleSharedUtilsConsumers,
  sampleUnrelatedPackageJson,
  sampleUnrelatedRepoSnapshot,
} from './fixtures/dependencies.js';

export {
  DEFAULT_LOCAL_DEPLOYMENT_BASE_URL,
  DEPLOYMENT_STATUSES,
  deploymentCreateRequestSchema,
  deploymentErrorSchema,
  deploymentIdParamsSchema,
  deploymentResponseSchema,
  deploymentStatusSchema,
  dockerComposeCommandSchema,
  healthCheckResultSchema,
} from './deployments.js';

export type {
  DeploymentCreateRequest,
  DeploymentError,
  DeploymentIdParams,
  DeploymentResponse,
  DeploymentStatus,
  DockerComposeCommand,
  HealthCheckResult,
} from './deployments.js';

export {
  sampleComposeDownCommand,
  sampleComposeUpCommand,
  sampleDeploymentCreateRequest,
  sampleDeploymentFailed,
  sampleDeploymentPending,
  sampleDeploymentRunning,
  sampleDeploymentStopped,
  sampleDockerBuildFailureOutput,
  sampleDockerBuildOutput,
  sampleDockerComposeYaml,
  sampleHealthCheckFailing,
  sampleHealthCheckPassing,
} from './fixtures/deployments.js';

export {
  buildVerificationChecklist,
  QA_HANDOFF_STATUSES,
  changeSummarySchema,
  checklistItemStatusSchema,
  handoffCoverageReportSchema,
  handoffJiraTicketSchema,
  qaFeedbackItemSchema,
  qaHandoffApproveRequestSchema,
  qaHandoffGenerateRequestSchema,
  qaHandoffRequestChangesRequestSchema,
  qaHandoffResponseSchema,
  qaHandoffStatusSchema,
  uncoveredLineEntrySchema,
  verificationChecklistItemSchema,
} from './qaHandoff.js';

export type {
  ChangeSummary,
  ChecklistItemStatus,
  HandoffCoverageReport,
  HandoffJiraTicket,
  QaFeedbackItem,
  QaHandoffApproveRequest,
  QaHandoffGenerateRequest,
  QaHandoffRequestChangesRequest,
  QaHandoffResponse,
  QaHandoffStatus,
  UncoveredLineEntry,
  VerificationChecklistItem,
} from './qaHandoff.js';

export {
  sampleChangeSummary,
  sampleHandoffCoverageReport,
  sampleHandoffJiraTicket,
  sampleQaFeedbackItems,
  sampleQaHandoffApproved,
  sampleQaHandoffChangesRequested,
  sampleQaHandoffGenerateRequest,
  sampleQaHandoffReady,
  sampleQaHandoffRequestChanges,
  sampleVerificationChecklist,
  sampleWorkflowHandoffInputs,
} from './fixtures/qaHandoff.js';

export {
  ADAPTER_STATUSES,
  DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS,
  INTEGRATION_ADAPTER_NAMES,
  adapterHealthResultSchema,
  adapterStatusSchema,
  integrationAdapterInfoSchema,
  integrationAdapterNameSchema,
  integrationsListResponseSchema,
} from './integrations.js';

export type {
  AdapterHealthResult,
  AdapterStatus,
  IntegrationAdapterInfo,
  IntegrationAdapterName,
  IntegrationsListResponse,
} from './integrations.js';

export {
  githubAdapterCapabilities,
  jiraAdapterCapabilities,
  opseraAdapterCapabilities,
  sampleAdapterHealthHealthy,
  sampleAdapterHealthUnhealthy,
  sampleGitHubAdapterInfo,
  sampleIntegrationsListResponse,
  sampleJiraAdapterInfo,
  sampleOpseraAdapterInfo,
} from './fixtures/integrations.js';

export {
  CLASSIFICATION_HANDLING,
  DATA_CLASSIFICATIONS,
  RETENTION_CATEGORIES,
  RETENTION_POLICY_DAYS,
  classificationHandlingSchema,
  dataClassificationSchema,
  getClassificationHandling,
  getRetentionPolicy,
  retentionCategorySchema,
  retentionPolicySchema,
  retentionPurgeResultSchema,
} from './dataClassification.js';

export type {
  ClassificationHandling,
  DataClassification,
  RetentionCategory,
  RetentionPolicy,
  RetentionPurgeResult,
} from './dataClassification.js';

export {
  sampleClassificationDocuments,
  sampleClassificationHandling,
  samplePiiValues,
  sampleRetentionPolicies,
  sampleRetentionPurgeResult,
} from './fixtures/dataClassification.js';

export {
  ERASURE_GRACE_PERIOD_MS,
  ERASURE_REQUEST_STATUSES,
  cancelErasureResponseSchema,
  dataExportResponseSchema,
  erasureExecutionSummarySchema,
  erasureRequestStatusSchema,
  erasureScheduleResponseSchema,
  scheduleErasureSchema,
  updateUserProfileResponseSchema,
  updateUserProfileSchema,
  userProfileExportSchema,
} from './gdprDsr.js';

export type {
  CancelErasureResponse,
  DataExportResponse,
  ErasureExecutionSummary,
  ErasureRequestStatus,
  ErasureScheduleResponse,
  ScheduleErasureInput,
  UpdateUserProfileInput,
  UpdateUserProfileResponse,
  UserProfileExport,
} from './gdprDsr.js';

export {
  sampleCancelErasureResponse,
  sampleDataExportResponse,
  sampleDsrUserDataset,
  sampleErasureExecutionSummary,
  sampleErasureScheduleResponse,
  sampleUpdateUserProfileInput,
  sampleUpdateUserProfileResponse,
  sampleUserProfileExport,
} from './fixtures/gdprDsr.js';
