import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runWithRequestContext } from '../../utils/requestContext.js';
import { auditService } from './auditService.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { ensureIndexes } from '../../database/indexes.js';

describe('AuditService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getAuditLogModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getAuditLogModel().collection.deleteMany({});
  });

  it('creates audit records with request context defaults', async () => {
    await runWithRequestContext(
      {
        correlationId: 'corr-123',
        actor: 'user-abc',
        resource: '/api/v1/test',
        operation: 'POST',
      },
      async () => {
        await auditService.log({
          resource: 'convention_settings/settings-1',
          operation: 'create',
          newValue: { commitMessageFormat: 'conventional' },
          ipAddress: '127.0.0.1',
        });
      },
    );

    const records = await getAuditLogModel().find({}).exec();
    expect(records).toHaveLength(1);
    expect(records[0]?.actor).toBe('user-abc');
    expect(records[0]?.resource).toBe('convention_settings/settings-1');
    expect(records[0]?.operation).toBe('create');
    expect(records[0]?.correlationId).toBe('corr-123');
    expect(records[0]?.ipAddress).toBe('127.0.0.1');
    expect(records[0]?.newValue).toEqual({ commitMessageFormat: 'conventional' });
  });

  it('returns paginated query results with ISO timestamps', async () => {
    await auditService.log({
      actor: 'user-001',
      resource: 'auth/sessions',
      operation: 'login',
      correlationId: 'corr-login',
      ipAddress: '10.0.0.1',
      newValue: { provider: 'github' },
    });

    const result = await auditService.query({ actor: 'user-001' }, 1, 10);

    expect(result.total).toBe(1);
    expect(result.records[0]?.actor).toBe('user-001');
    expect(result.records[0]?.operation).toBe('login');
    expect(result.records[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
