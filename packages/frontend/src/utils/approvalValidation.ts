import type { ApprovalAction } from '@autodev/shared-types';

export interface ApprovalDecisionInput {
  action: ApprovalAction;
  rationale?: string;
  modifiedValue?: string;
}

export interface ApprovalDecisionErrors {
  rationale?: string;
  modifiedValue?: string;
}

export function validateApprovalDecision(
  input: ApprovalDecisionInput,
): ApprovalDecisionErrors | undefined {
  const errors: ApprovalDecisionErrors = {};
  const rationale = input.rationale?.trim() ?? '';
  const modifiedValue = input.modifiedValue?.trim() ?? '';

  if ((input.action === 'reject' || input.action === 'modify') && !rationale) {
    errors.rationale = 'Rationale is required for reject and modify actions.';
  }

  if (input.action === 'modify' && !modifiedValue) {
    errors.modifiedValue = 'Modified value is required when action is modify.';
  }

  if (Object.keys(errors).length === 0) {
    return undefined;
  }

  return errors;
}

export function formatExpiryCountdown(expiresAt: string, nowMs = Date.now()): string {
  const remainingMs = new Date(expiresAt).getTime() - nowMs;

  if (Number.isNaN(remainingMs)) {
    return 'Expiry unknown';
  }

  if (remainingMs <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${Math.max(minutes, 1)}m remaining`;
}

export function getApprovalProgress(resolvedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((resolvedCount / totalCount) * 100));
}
