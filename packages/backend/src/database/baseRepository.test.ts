import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BaseRepository } from './baseRepository.js';
import { ensureIndexes } from './indexes.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { getUserModel, type UserDocument, type UserRecord } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

describe('BaseRepository', () => {
  const repository = new BaseRepository<UserDocument>(getUserModel());

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getUserModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
  });

  it('creates documents with audit fields populated', async () => {
    const created = await repository.create(
      {
        email: 'alex.dev@example.com',
        displayName: 'Alex Developer',
        role: 'user',
        dataClassification: 'internal',
      },
      'user-001',
    );

    expect(created.email).toBe('alex.dev@example.com');
    expect(created.createdBy).toBe('user-001');
    expect(created.updatedBy).toBe('user-001');
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it('updates documents using parameterized queries', async () => {
    const created = (await repository.create(
      {
        email: 'dana.lead@example.com',
        displayName: 'Dana Team Lead',
        role: 'admin',
        dataClassification: 'confidential',
      },
      'user-002',
    )) as UserRecord;

    const updated = await repository.updateById(
      created.id,
      { displayName: 'Dana Lead' },
      'user-003',
    );

    expect(updated?.displayName).toBe('Dana Lead');
    expect(updated?.updatedBy).toBe('user-003');
  });

  it('finds and deletes documents by id', async () => {
    const created = (await repository.create(
      {
        email: 'qa@example.com',
        displayName: 'QA User',
        role: 'user',
        dataClassification: 'internal',
      },
      'user-004',
    )) as UserRecord;

    const found = await repository.findById(created.id);
    expect(found?.email).toBe('qa@example.com');

    const deleted = await repository.deleteById(created.id);
    expect(deleted).toBe(true);
    expect(await repository.findById(created.id)).toBeNull();
  });

  it('seeds fixture documents for downstream work orders', async () => {
    await seedDocuments(getUserModel(), sampleUserDocuments);

    const users = await getUserModel().find({ role: 'admin' }).exec();
    expect(users).toHaveLength(1);
    expect(users[0]?.createdBy).toBe('seed@autodev.local');
  });
});
