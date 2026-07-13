import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { sampleAutoDevLikeContext } from '@autodev/shared-types';
import {
  sampleAiInteractionLogFixture,
  sampleConfidentialProfile,
  sampleRestrictedToken,
} from '../../fixtures/dataClassification.js';
import {
  buildAiInteractionExpiryDate,
  getAiInteractionLogModel,
} from '../../models/aiInteractionLogModel.js';
import { buildAnalysisExpiryDate, getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import {
  cryptographicallyErase,
  decryptConfidentialFields,
  decryptRestricted,
  decryptWithPerRecordDek,
  encryptConfidentialFields,
  encryptRestricted,
  encryptWithPerRecordDek,
} from '../../lib/encryption.js';
import { maskPiiInText } from '../../lib/piiMasking.js';
import { logger, parseLogLine, resetLogWriter, setLogWriter } from '../../utils/logger.js';
import { runRetentionPurge } from './retentionJob.js';

describe('data classification lifecycle (integration)', () => {
  let mongo: MongoMemoryServer;
  const lines: string[] = [];

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }, 60_000);

  beforeEach(async () => {
    lines.length = 0;
    resetLogWriter();
    setLogWriter((line) => {
      lines.push(line);
    });

    await Promise.all([
      getAiInteractionLogModel().deleteMany({}),
      getCodebaseContextModel().deleteMany({}),
      getAuditLogModel().collection.deleteMany({}),
    ]);
  });

  afterEach(() => {
    resetLogWriter();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('encrypts Restricted tokens and Confidential fields, then cryptographically erases', () => {
    const restricted = encryptRestricted(sampleRestrictedToken.plaintext);
    expect(decryptRestricted(restricted)).toBe(sampleRestrictedToken.plaintext);

    const encryptedProfile = encryptConfidentialFields({ ...sampleConfidentialProfile }, [
      'email',
      'displayName',
    ]);
    expect(encryptedProfile.email).not.toContain('@');
    const decrypted = decryptConfidentialFields(encryptedProfile, ['email', 'displayName']);
    expect(decrypted.email).toBe(sampleConfidentialProfile.email);

    const wrapped = encryptWithPerRecordDek(sampleAiInteractionLogFixture.plaintextPayload);
    expect(decryptWithPerRecordDek(wrapped)).toContain('Jane Doe');
    const erased = cryptographicallyErase(wrapped);
    expect(() => decryptWithPerRecordDek(erased)).toThrow(/destroyed/);
  });

  it('masks PII in logger output', () => {
    logger.info(`User ${sampleConfidentialProfile.email} (${sampleConfidentialProfile.displayName}) login`, {
      actor: sampleConfidentialProfile.email,
      resource: 'auth',
      operation: 'login',
    });

    const entry = parseLogLine(lines[0] ?? '');
    expect(entry.message).not.toContain(sampleConfidentialProfile.email);
    expect(entry.message).not.toContain(sampleConfidentialProfile.displayName);
    expect(entry.actor).toBe(maskPiiInText(sampleConfidentialProfile.email));
  });

  it('persists AI logs and purges expired analysis / AI / audit via retention job', async () => {
    const now = new Date('2026-07-13T00:00:00.000Z');
    const wrapped = encryptWithPerRecordDek(sampleAiInteractionLogFixture.plaintextPayload);

    await getAiInteractionLogModel().create({
      userId: sampleAiInteractionLogFixture.userId,
      provider: sampleAiInteractionLogFixture.provider,
      model: sampleAiInteractionLogFixture.model,
      promptHash: sampleAiInteractionLogFixture.promptHash,
      encryptedPayload: JSON.stringify(wrapped),
      dataClassification: 'confidential',
      createdBy: 'test',
      updatedBy: 'test',
      expiresAt: buildAiInteractionExpiryDate(now.getTime() - 100 * 24 * 60 * 60 * 1000),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await getCodebaseContextModel().create({
      userId: 'user-1',
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
      branch: sampleAutoDevLikeContext.branch,
      treeFingerprint: 'fp-1',
      context: { ...sampleAutoDevLikeContext },
      dataClassification: 'internal',
      createdBy: 'test',
      updatedBy: 'test',
      expiresAt: buildAnalysisExpiryDate(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    await getAuditLogModel().collection.insertOne({
      actor: 'user-1',
      resource: 'users',
      operation: 'create',
      correlationId: 'corr-old',
      dataClassification: 'confidential',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const result = await runRetentionPurge({ clock: () => now });

    expect(result.purged.ai_interaction_logs).toBeGreaterThanOrEqual(1);
    expect(result.purged.repo_analysis).toBeGreaterThanOrEqual(1);
    expect(result.purged.audit_logs).toBeGreaterThanOrEqual(1);

    expect(await getAiInteractionLogModel().countDocuments()).toBe(0);
    expect(await getCodebaseContextModel().countDocuments()).toBe(0);
    expect(await getAuditLogModel().collection.countDocuments()).toBe(0);
  });
});
