import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IMMUTABLE_ERROR, getAuditLogModel } from '../models/auditLogModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';

describe('audit log immutability', () => {
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

  it('rejects update and delete operations', async () => {
    const record = await getAuditLogModel().create({
      actor: 'user-001',
      resource: 'auth/sessions',
      operation: 'login',
      correlationId: 'corr-1',
      dataClassification: 'confidential',
    });

    await expect(
      getAuditLogModel().updateOne({ _id: record._id }, { actor: 'hacker' }).exec(),
    ).rejects.toThrow(IMMUTABLE_ERROR);

    await expect(getAuditLogModel().deleteOne({ _id: record._id }).exec()).rejects.toThrow(
      IMMUTABLE_ERROR,
    );
  });

  it('defines a one-year TTL index on createdAt', async () => {
    const indexes = await getAuditLogModel().collection.indexes();
    const ttlIndex = indexes.find((index) => index.expireAfterSeconds === 365 * 24 * 60 * 60);

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex?.key).toEqual({ createdAt: 1 });
  });
});
