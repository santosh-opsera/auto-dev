import { z } from 'zod';
import { divergenceSchema } from './divergence.js';
import { gapItemSchema } from './ticketIntent.js';
import { ticketKeySchema } from './tickets.js';

export const APPROVAL_TTL_HOURS = 72;
export const APPROVAL_REMINDER_HOURS = [24, 48] as const;

export const approvalItemTypeSchema = z.enum(['gap', 'divergence']);
export type ApprovalItemType = z.infer<typeof approvalItemTypeSchema>;

export const approvalItemStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'modified',
  'expired',
]);
export type ApprovalItemStatus = z.infer<typeof approvalItemStatusSchema>;

export const approvalActionSchema = z.enum(['approve', 'reject', 'modify']);
export type ApprovalAction = z.infer<typeof approvalActionSchema>;

export const approvalRequestStatusSchema = z.enum(['open', 'cleared', 'blocked']);
export type ApprovalRequestStatus = z.infer<typeof approvalRequestStatusSchema>;

export const approvalReminderMarkSchema = z.enum(['24h', '48h']);
export type ApprovalReminderMark = z.infer<typeof approvalReminderMarkSchema>;

export const approvalDecisionSchema = z.object({
  action: approvalActionSchema,
  rationale: z.string().max(4000).optional(),
  modifiedValue: z.string().max(8000).optional(),
  resolvedAt: z.string().datetime(),
  resolvedBy: z.string().min(1),
});

export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const approvalItemSchema = z.object({
  itemId: z.string().min(1),
  type: approvalItemTypeSchema,
  status: approvalItemStatusSchema,
  sourceRef: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  gap: gapItemSchema.optional(),
  divergence: divergenceSchema.optional(),
  decision: approvalDecisionSchema.optional(),
  remindersSent: z.array(approvalReminderMarkSchema).default([]),
});

export type ApprovalItem = z.infer<typeof approvalItemSchema>;

export const approvalCreateRequestSchema = z.object({
  workflowId: z.string().min(1),
});

export type ApprovalCreateRequest = z.infer<typeof approvalCreateRequestSchema>;

export const approvalResolveRequestSchema = z
  .object({
    action: approvalActionSchema,
    rationale: z.string().max(4000).optional(),
    modifiedValue: z.string().max(8000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'modify' && !value.modifiedValue?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'modifiedValue is required when action is modify',
        path: ['modifiedValue'],
      });
    }
  });

export type ApprovalResolveRequest = z.infer<typeof approvalResolveRequestSchema>;

export const approvalRequestIdParamsSchema = z.object({
  requestId: z.string().min(1),
});

export const approvalItemParamsSchema = z.object({
  requestId: z.string().min(1),
  itemId: z.string().min(1),
});

export const approvalRequestResponseSchema = z.object({
  id: z.string().min(1),
  ticketKey: ticketKeySchema,
  workflowId: z.string().min(1),
  ticketIntentId: z.string().min(1),
  divergenceRecordId: z.string().optional(),
  status: approvalRequestStatusSchema,
  items: z.array(approvalItemSchema),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApprovalRequestResponse = z.infer<typeof approvalRequestResponseSchema>;

export const approvalStatusResponseSchema = z.object({
  requestId: z.string().min(1),
  ticketKey: ticketKeySchema,
  canProceed: z.boolean(),
  pendingCount: z.number().int().nonnegative(),
  expiredCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  status: approvalRequestStatusSchema,
  expiresAt: z.string().datetime(),
});

export type ApprovalStatusResponse = z.infer<typeof approvalStatusResponseSchema>;
