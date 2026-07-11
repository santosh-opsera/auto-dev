import type { AuditOperation } from '../models/auditLogModel.js';

export const sampleAuditLogEntries = [
  {
    actor: 'user-001',
    resource: 'auth/sessions',
    operation: 'login' as AuditOperation,
    newValue: { provider: 'github' },
    correlationId: 'corr-login-001',
    ipAddress: '127.0.0.1',
  },
  {
    actor: 'user-001',
    resource: 'auth/sessions',
    operation: 'logout' as AuditOperation,
    previousValue: { sessionId: 'session-001' },
    correlationId: 'corr-logout-001',
    ipAddress: '127.0.0.1',
  },
  {
    actor: 'anonymous',
    resource: 'auth/sessions',
    operation: 'login_failed' as AuditOperation,
    newValue: { reason: 'invalid_oauth_code' },
    correlationId: 'corr-failure-001',
    ipAddress: '10.0.0.5',
  },
  {
    actor: 'user-002',
    resource: 'convention_settings/settings-001',
    operation: 'create' as AuditOperation,
    newValue: { commitMessageFormat: 'conventional' },
    correlationId: 'corr-convention-001',
    ipAddress: '127.0.0.1',
  },
];

export const sampleAuditMutationPayload = {
  resource: 'convention_settings/test-001',
  previousValue: null,
  newValue: { commitMessageFormat: 'conventional' },
};
