import { describe, expect, it } from 'vitest';
import {
  formatExpiryCountdown,
  getApprovalProgress,
  validateApprovalDecision,
} from './approvalValidation';

describe('validateApprovalDecision', () => {
  it('allows approve without rationale', () => {
    expect(validateApprovalDecision({ action: 'approve' })).toBeUndefined();
  });

  it('requires rationale for reject', () => {
    expect(validateApprovalDecision({ action: 'reject' })).toEqual({
      rationale: 'Rationale is required for reject and modify actions.',
    });
  });

  it('requires rationale and modifiedValue for modify', () => {
    expect(validateApprovalDecision({ action: 'modify', rationale: 'Adjust' })).toEqual({
      modifiedValue: 'Modified value is required when action is modify.',
    });

    expect(
      validateApprovalDecision({
        action: 'modify',
        rationale: 'Adjust',
        modifiedValue: 'Use camelCase helpers',
      }),
    ).toBeUndefined();
  });
});

describe('formatExpiryCountdown', () => {
  it('formats remaining time toward expiry', () => {
    const now = Date.parse('2026-07-13T08:00:00.000Z');
    const expiresAt = '2026-07-14T08:00:00.000Z';

    expect(formatExpiryCountdown(expiresAt, now)).toBe('1d 0h remaining');
  });

  it('returns Expired when past expiresAt', () => {
    const now = Date.parse('2026-07-15T08:00:00.000Z');
    expect(formatExpiryCountdown('2026-07-14T08:00:00.000Z', now)).toBe('Expired');
  });
});

describe('getApprovalProgress', () => {
  it('calculates resolved percentage', () => {
    expect(getApprovalProgress(1, 4)).toBe(25);
    expect(getApprovalProgress(0, 0)).toBe(0);
    expect(getApprovalProgress(3, 3)).toBe(100);
  });
});
