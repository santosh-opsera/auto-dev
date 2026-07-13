import { z } from 'zod';
import { ticketKeySchema } from './tickets.js';

export const WORKFLOW_STATES = [
  'CREATED',
  'TICKET_PARSED',
  'ANALYZING',
  'ANALYSIS_COMPLETE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IMPLEMENTING',
  'TESTING',
  'TEST_PASSED',
  'PR_CREATING',
  'PR_CREATED',
  'PAUSED',
  'CANCELLED',
  'FAILED',
] as const;

export const workflowStateSchema = z.enum(WORKFLOW_STATES);
export type WorkflowState = z.infer<typeof workflowStateSchema>;

export const TERMINAL_WORKFLOW_STATES = ['PR_CREATED', 'CANCELLED'] as const;
export type TerminalWorkflowState = (typeof TERMINAL_WORKFLOW_STATES)[number];

export const PAUSABLE_WORKFLOW_STATES = ['IMPLEMENTING', 'TESTING'] as const;
export type PausableWorkflowState = (typeof PAUSABLE_WORKFLOW_STATES)[number];

export const workflowErrorSchema = z.object({
  message: z.string().min(1).max(4000),
  code: z.string().min(1).max(200).optional(),
  failedFrom: workflowStateSchema.optional(),
});

export type WorkflowError = z.infer<typeof workflowErrorSchema>;

export const workflowTransitionRecordSchema = z.object({
  timestamp: z.string().datetime(),
  previousState: workflowStateSchema,
  newState: workflowStateSchema,
  trigger: z.string().min(1).max(200),
});

export type WorkflowTransitionRecord = z.infer<typeof workflowTransitionRecordSchema>;

export const workflowProgressSchema = z.object({
  percent: z.number().min(0).max(100).optional(),
  phase: z.string().max(200).optional(),
  chunkId: z.string().max(200).optional(),
});

export type WorkflowProgress = z.infer<typeof workflowProgressSchema>;

export const workflowCreateRequestSchema = z.object({
  ticketKey: ticketKeySchema,
  workflowId: z.string().min(1).max(200).optional(),
});

export type WorkflowCreateRequest = z.infer<typeof workflowCreateRequestSchema>;

export const workflowIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const workflowListQuerySchema = z.object({
  state: workflowStateSchema.optional(),
});

export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>;

export const workflowTransitionRequestSchema = z.object({
  toState: workflowStateSchema,
  trigger: z.string().min(1).max(200).optional(),
});

export type WorkflowTransitionRequest = z.infer<typeof workflowTransitionRequestSchema>;

export const workflowFailRequestSchema = z.object({
  error: z.object({
    message: z.string().min(1).max(4000),
    code: z.string().min(1).max(200).optional(),
  }),
});

export type WorkflowFailRequest = z.infer<typeof workflowFailRequestSchema>;

export const workflowResponseSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  ticketKey: ticketKeySchema,
  state: workflowStateSchema,
  history: z.array(workflowTransitionRecordSchema),
  availableTransitions: z.array(workflowStateSchema),
  progress: workflowProgressSchema.optional(),
  pausedFrom: workflowStateSchema.nullable().optional(),
  resumedFrom: workflowStateSchema.nullable().optional(),
  error: workflowErrorSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowResponse = z.infer<typeof workflowResponseSchema>;

export const workflowListResponseSchema = z.object({
  workflows: z.array(workflowResponseSchema),
});

export type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export function isTerminalWorkflowState(state: WorkflowState): boolean {
  return (TERMINAL_WORKFLOW_STATES as readonly string[]).includes(state);
}

export function isPausableWorkflowState(state: WorkflowState): state is PausableWorkflowState {
  return (PAUSABLE_WORKFLOW_STATES as readonly string[]).includes(state);
}
