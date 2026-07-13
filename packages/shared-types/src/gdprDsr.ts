import { z } from 'zod';
import { conventionSettingsResponseSchema } from './conventions.js';
import { repositoryConnectionSchema } from './repositories.js';
import { workflowResponseSchema } from './workflow.js';

/** Mirrors auditLogRecordSchema in index.ts without circular imports. */
const dataExportAuditLogSchema = z.object({
  id: z.string(),
  actor: z.string(),
  timestamp: z.string().datetime(),
  resource: z.string(),
  operation: z.enum([
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'login_failed',
    'token_refresh',
    'lockout',
  ]),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  correlationId: z.string(),
  ipAddress: z.string().optional(),
});

/** 24-hour grace period before scheduled GDPR erasure executes. */
export const ERASURE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export const ERASURE_REQUEST_STATUSES = ['pending', 'cancelled', 'executed'] as const;
export const erasureRequestStatusSchema = z.enum(ERASURE_REQUEST_STATUSES);
export type ErasureRequestStatus = z.infer<typeof erasureRequestStatusSchema>;

export const userProfileExportSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(['user', 'admin']),
  connectedProviders: z.array(z.enum(['github', 'atlassian'])),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfileExport = z.infer<typeof userProfileExportSchema>;

export const updateUserProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(120, 'Display name must be at most 120 characters'),
  email: z.string().trim().email('A valid email address is required').max(254),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const updateUserProfileResponseSchema = z.object({
  profile: userProfileExportSchema,
});

export type UpdateUserProfileResponse = z.infer<typeof updateUserProfileResponseSchema>;

/** Portable JSON export for GDPR access / portability (Art. 15 / 20). */
export const dataExportResponseSchema = z.object({
  exportedAt: z.string().datetime(),
  profile: userProfileExportSchema,
  conventionSettings: z.array(conventionSettingsResponseSchema),
  workflowHistory: z.array(workflowResponseSchema),
  auditLogs: z.array(dataExportAuditLogSchema),
  connectedRepositories: z.array(repositoryConnectionSchema),
});

export type DataExportResponse = z.infer<typeof dataExportResponseSchema>;

export const scheduleErasureSchema = z.object({
  confirmationEmail: z
    .string()
    .trim()
    .email('Confirmation email must be a valid email address')
    .max(254),
});

export type ScheduleErasureInput = z.infer<typeof scheduleErasureSchema>;

export const erasureScheduleResponseSchema = z.object({
  requestId: z.string().min(1),
  status: erasureRequestStatusSchema,
  requestedAt: z.string().datetime(),
  scheduledFor: z.string().datetime(),
  gracePeriodMs: z.number().int().positive(),
  message: z.string().min(1),
});

export type ErasureScheduleResponse = z.infer<typeof erasureScheduleResponseSchema>;

export const cancelErasureResponseSchema = z.object({
  requestId: z.string().min(1),
  status: z.literal('cancelled'),
  cancelledAt: z.string().datetime(),
  message: z.string().min(1),
});

export type CancelErasureResponse = z.infer<typeof cancelErasureResponseSchema>;

export const erasureExecutionSummarySchema = z.object({
  userId: z.string().min(1),
  executedAt: z.string().datetime(),
  cryptographicallyErased: z.object({
    oauthTokenFields: z.number().int().nonnegative(),
    aiInteractionPayloads: z.number().int().nonnegative(),
  }),
  purged: z.object({
    sessions: z.number().int().nonnegative(),
    conventionSettings: z.number().int().nonnegative(),
    workflows: z.number().int().nonnegative(),
    connectedRepositories: z.number().int().nonnegative(),
    aiInteractionLogs: z.number().int().nonnegative(),
    auditRecords: z.number().int().nonnegative(),
    userRecord: z.number().int().nonnegative(),
  }),
});

export type ErasureExecutionSummary = z.infer<typeof erasureExecutionSummarySchema>;
