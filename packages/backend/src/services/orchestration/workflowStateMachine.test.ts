import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/errors.js';
import {
  assertCanCancel,
  assertCanFail,
  assertCanPause,
  assertCanResume,
  assertCanRetry,
  assertValidHappyPathTransition,
  assertValidTransition,
  getAvailableTransitions,
  getHappyPathTransitions,
} from './workflowStateMachine.js';

describe('workflowStateMachine', () => {
  it('defines happy-path transitions for the full lifecycle', () => {
    expect(getHappyPathTransitions('CREATED')).toEqual(['TICKET_PARSED']);
    expect(getHappyPathTransitions('TICKET_PARSED')).toEqual(['ANALYZING']);
    expect(getHappyPathTransitions('ANALYZING')).toEqual(['ANALYSIS_COMPLETE']);
    expect(getHappyPathTransitions('ANALYSIS_COMPLETE')).toEqual(['AWAITING_APPROVAL']);
    expect(getHappyPathTransitions('AWAITING_APPROVAL')).toEqual(['APPROVED']);
    expect(getHappyPathTransitions('APPROVED')).toEqual(['IMPLEMENTING']);
    expect(getHappyPathTransitions('IMPLEMENTING')).toEqual(['TESTING']);
    expect(getHappyPathTransitions('TESTING')).toEqual(['TEST_PASSED']);
    expect(getHappyPathTransitions('TEST_PASSED')).toEqual(['PR_CREATING']);
    expect(getHappyPathTransitions('PR_CREATING')).toEqual(['PR_CREATED']);
    expect(getHappyPathTransitions('PR_CREATED')).toEqual([]);
  });

  it('exposes pause/cancel/fail on pausable states', () => {
    expect(getAvailableTransitions('IMPLEMENTING')).toEqual([
      'TESTING',
      'PAUSED',
      'CANCELLED',
      'FAILED',
    ]);
    expect(getAvailableTransitions('TESTING')).toEqual([
      'TEST_PASSED',
      'PAUSED',
      'CANCELLED',
      'FAILED',
    ]);
  });

  it('rejects invalid happy-path transitions', () => {
    expect(() => assertValidHappyPathTransition('CREATED', 'IMPLEMENTING')).toThrow(AppError);
    expect(() => assertValidTransition('CREATED', 'IMPLEMENTING')).toThrow(AppError);
    expect(() => assertValidHappyPathTransition('PR_CREATED', 'TESTING')).toThrow(AppError);
  });

  it('supports pause and resume targets', () => {
    assertCanPause('IMPLEMENTING');
    assertCanPause('TESTING');
    expect(() => assertCanPause('APPROVED')).toThrow(AppError);

    expect(assertCanResume('PAUSED', 'IMPLEMENTING')).toBe('IMPLEMENTING');
    expect(() => assertCanResume('IMPLEMENTING', 'IMPLEMENTING')).toThrow(AppError);
    expect(() => assertCanResume('PAUSED', null)).toThrow(AppError);

    expect(getAvailableTransitions('PAUSED', { pausedFrom: 'TESTING' })).toEqual([
      'TESTING',
      'CANCELLED',
      'FAILED',
    ]);
  });

  it('supports cancel from non-terminal states only', () => {
    assertCanCancel('CREATED');
    assertCanCancel('FAILED');
    expect(() => assertCanCancel('PR_CREATED')).toThrow(AppError);
    expect(() => assertCanCancel('CANCELLED')).toThrow(AppError);
  });

  it('supports fail and retry error recovery', () => {
    assertCanFail('ANALYZING');
    expect(() => assertCanFail('FAILED')).toThrow(AppError);
    expect(() => assertCanFail('CANCELLED')).toThrow(AppError);

    expect(assertCanRetry('FAILED', 'TESTING')).toBe('TESTING');
    expect(() => assertCanRetry('TESTING', 'TESTING')).toThrow(AppError);
    expect(() => assertCanRetry('FAILED', null)).toThrow(AppError);

    expect(getAvailableTransitions('FAILED', { failedFrom: 'TESTING' })).toEqual([
      'TESTING',
      'CANCELLED',
    ]);
  });
});
