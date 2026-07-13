import { z } from 'zod';

export const QA_HANDOFF_STATUSES = ['READY', 'APPROVED', 'CHANGES_REQUESTED'] as const;
export const qaHandoffStatusSchema = z.enum(QA_HANDOFF_STATUSES);
export type QaHandoffStatus = z.infer<typeof qaHandoffStatusSchema>;

export const checklistItemStatusSchema = z.enum(['unchecked', 'checked', 'blocked']);
export type ChecklistItemStatus = z.infer<typeof checklistItemStatusSchema>;

export const verificationChecklistItemSchema = z.object({
  id: z.string().min(1),
  /** Acceptance criterion text this checklist item was derived from. */
  acceptanceCriterion: z.string().min(1),
  /** Checkable status for QA verification. */
  status: checklistItemStatusSchema,
  notes: z.string().max(2000).optional(),
});

export type VerificationChecklistItem = z.infer<typeof verificationChecklistItemSchema>;

export const changeSummarySchema = z.object({
  filesChanged: z.array(z.string().min(1)),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  affectedModules: z.array(z.string().min(1)).optional(),
});

export type ChangeSummary = z.infer<typeof changeSummarySchema>;

export const uncoveredLineEntrySchema = z.object({
  filePath: z.string().min(1),
  lines: z.array(z.number().int().positive()),
});

export type UncoveredLineEntry = z.infer<typeof uncoveredLineEntrySchema>;

export const handoffCoverageReportSchema = z.object({
  coveragePercent: z.number().min(0).max(100),
  uncoveredLines: z.array(uncoveredLineEntrySchema),
  lines: z.number().min(0).max(100).optional(),
  branches: z.number().min(0).max(100).optional(),
  functions: z.number().min(0).max(100).optional(),
  statements: z.number().min(0).max(100).optional(),
});

export type HandoffCoverageReport = z.infer<typeof handoffCoverageReportSchema>;

export const handoffJiraTicketSchema = z.object({
  ticketKey: z.string().min(1),
  summary: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)),
  url: z.string().url().optional(),
});

export type HandoffJiraTicket = z.infer<typeof handoffJiraTicketSchema>;

export const qaFeedbackItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(4000),
  checklistItemId: z.string().min(1).optional(),
});

export type QaFeedbackItem = z.infer<typeof qaFeedbackItemSchema>;

export const qaHandoffGenerateRequestSchema = z
  .object({
    changeSummary: changeSummarySchema.optional(),
    coverageReport: handoffCoverageReportSchema.optional(),
    deploymentUrl: z.string().url().optional(),
    jiraTicket: handoffJiraTicketSchema.optional(),
    /** When true, regenerate even if a handoff already exists for the workflow. */
    force: z.boolean().optional(),
  })
  .default({});

export type QaHandoffGenerateRequest = z.infer<typeof qaHandoffGenerateRequestSchema>;

export const qaHandoffApproveRequestSchema = z
  .object({
    notes: z.string().max(4000).optional(),
  })
  .default({});

export type QaHandoffApproveRequest = z.infer<typeof qaHandoffApproveRequestSchema>;

export const qaHandoffRequestChangesRequestSchema = z.object({
  feedbackItems: z.array(qaFeedbackItemSchema).min(1),
});

export type QaHandoffRequestChangesRequest = z.infer<typeof qaHandoffRequestChangesRequestSchema>;

export const qaHandoffResponseSchema = z.object({
  id: z.string().min(1),
  workflowDocumentId: z.string().min(1),
  workflowId: z.string().min(1),
  status: qaHandoffStatusSchema,
  changeSummary: changeSummarySchema,
  jiraTicket: handoffJiraTicketSchema,
  coverageReport: handoffCoverageReportSchema,
  verificationChecklist: z.array(verificationChecklistItemSchema),
  deploymentUrl: z.string().url(),
  feedbackItems: z.array(qaFeedbackItemSchema).optional(),
  approvedAt: z.string().datetime().optional(),
  changesRequestedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type QaHandoffResponse = z.infer<typeof qaHandoffResponseSchema>;

/**
 * Builds a verification checklist from acceptance criteria.
 * Each criterion becomes a checkable item with status `unchecked`.
 */
export function buildVerificationChecklist(
  acceptanceCriteria: string[],
): VerificationChecklistItem[] {
  return acceptanceCriteria.map((criterion, index) => ({
    id: `ac-${index + 1}`,
    acceptanceCriterion: criterion,
    status: 'unchecked' as const,
  }));
}
