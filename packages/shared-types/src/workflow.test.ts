import { describe, expect, it } from 'vitest';
import {
  isPausableWorkflowState,
  isTerminalWorkflowState,
  workflowCreateRequestSchema,
  workflowFailRequestSchema,
  workflowListQuerySchema,
  workflowResponseSchema,
  workflowTransitionRequestSchema,
  WORKFLOW_STATES,
} from './workflow.js';
import {
  sampleWorkflowCompleted,
  sampleWorkflowCreated,
  sampleWorkflowFailed,
  sampleWorkflowPaused,
} from './fixtures/workflow.js';

describe('workflow schemas', () => {
  it('defines all required workflow states', () => {
    expect(WORKFLOW_STATES).toEqual([
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
    ]);
  });

  it('validates fixture workflow responses', () => {
    expect(workflowResponseSchema.safeParse(sampleWorkflowCreated).success).toBe(true);
    expect(workflowResponseSchema.safeParse(sampleWorkflowPaused).success).toBe(true);
    expect(workflowResponseSchema.safeParse(sampleWorkflowFailed).success).toBe(true);
    expect(workflowResponseSchema.safeParse(sampleWorkflowCompleted).success).toBe(true);
  });

  it('validates create, transition, fail, and list query payloads', () => {
    expect(
      workflowCreateRequestSchema.safeParse({ ticketKey: 'OPL-7001', workflowId: 'wf-1' }).success,
    ).toBe(true);
    expect(
      workflowTransitionRequestSchema.safeParse({
        toState: 'TICKET_PARSED',
        trigger: 'ticket.parsed',
      }).success,
    ).toBe(true);
    expect(
      workflowFailRequestSchema.safeParse({
        error: { message: 'boom', code: 'ERR' },
      }).success,
    ).toBe(true);
    expect(workflowListQuerySchema.safeParse({ state: 'PAUSED' }).success).toBe(true);
  });

  it('identifies terminal and pausable states', () => {
    expect(isTerminalWorkflowState('PR_CREATED')).toBe(true);
    expect(isTerminalWorkflowState('CANCELLED')).toBe(true);
    expect(isTerminalWorkflowState('FAILED')).toBe(false);
    expect(isPausableWorkflowState('IMPLEMENTING')).toBe(true);
    expect(isPausableWorkflowState('TESTING')).toBe(true);
    expect(isPausableWorkflowState('APPROVED')).toBe(false);
  });
});
