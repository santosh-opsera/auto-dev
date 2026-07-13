import type { AuditLogRecord } from '@autodev/shared-types';

/** Sample audit log records for UI fixtures (locale-aware timestamps). */
export const sampleAuditLogRecords: AuditLogRecord[] = [
  {
    id: 'audit-001',
    actor: 'user-001',
    timestamp: '2026-07-13T14:30:00.000Z',
    resource: 'workflow/workflow-001',
    operation: 'update',
    newValue: { state: 'APPROVED' },
    correlationId: 'corr-audit-001',
    ipAddress: '127.0.0.1',
  },
  {
    id: 'audit-002',
    actor: 'user-002',
    timestamp: '2026-07-12T09:15:00.000Z',
    resource: 'convention_settings/settings-001',
    operation: 'create',
    newValue: { commitMessageFormat: 'conventional' },
    correlationId: 'corr-audit-002',
  },
  {
    id: 'audit-003',
    actor: 'anonymous',
    timestamp: '2026-07-11T18:00:00.000Z',
    resource: 'auth/sessions',
    operation: 'login_failed',
    newValue: { reason: 'invalid_oauth_code' },
    correlationId: 'corr-audit-003',
    ipAddress: '10.0.0.5',
  },
];
