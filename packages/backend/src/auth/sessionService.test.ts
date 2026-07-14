import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { Response } from 'express';
import { SESSION_IDLE_MS, SESSION_WARNING_MS } from './constants.js';
import {
  buildSessionMetadata,
  createSession,
  invalidateSession,
  touchSession,
} from './sessionService.js';
import { ensureIndexes } from '../database/indexes.js';
import { getSessionModel } from '../models/sessionModel.js';
import { sseManager } from '../services/events/sseManager.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

function createMockResponse(): Response {
  return {
    writableEnded: false,
    destroyed: false,
    write: vi.fn().mockReturnValue(true),
    writeHead: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  } as unknown as Response;
}

describe('sessionService touchSession', () => {
  const userId = new mongoose.Types.ObjectId().toHexString();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getSessionModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getSessionModel().deleteMany({});
    sseManager.closeAllConnections();
  });

  it('atomically extends expiresAt for a valid session', async () => {
    const { sessionId, metadata: created } = await createSession(userId);
    const before = await getSessionModel().findOne({ sessionId }).lean().exec();
    expect(before).toBeTruthy();

    const touched = await touchSession(sessionId);
    expect(touched).not.toBeNull();
    expect(touched!.sessionId).toBe(sessionId);
    expect(touched!.remainingMs).toBeGreaterThan(SESSION_IDLE_MS - 5_000);
    expect(touched!.warning).toBe(false);

    const after = await getSessionModel().findOne({ sessionId }).lean().exec();
    expect(after).toBeTruthy();
    expect(after!.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime() - 1);
    expect(after!.expiresAt.getTime()).toBeGreaterThanOrEqual(created.expiresAt.getTime());
    expect(after!.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before!.lastActivityAt.getTime());
  });

  it('rejects an expired session without rewriting expiry', async () => {
    const { sessionId } = await createSession(userId);
    const expiredAt = new Date(Date.now() - 1_000);
    await getSessionModel()
      .updateOne({ sessionId }, { $set: { expiresAt: expiredAt } })
      .exec();

    const touched = await touchSession(sessionId);
    expect(touched).toBeNull();

    const stored = await getSessionModel().findOne({ sessionId }).lean().exec();
    expect(stored).toBeTruthy();
    expect(stored!.expiresAt.getTime()).toBe(expiredAt.getTime());
  });

  it('returns null for a missing session id', async () => {
    const touched = await touchSession('00000000-0000-4000-8000-000000000000');
    expect(touched).toBeNull();
    expect(await getSessionModel().countDocuments()).toBe(0);
  });

  it('buildSessionMetadata sets warning when remainingMs is within threshold', () => {
    const nearExpiry = new Date(Date.now() + SESSION_WARNING_MS - 30_000);
    const metadata = buildSessionMetadata('sess-1', userId, nearExpiry);

    expect(metadata.remainingMs).toBeLessThanOrEqual(SESSION_WARNING_MS);
    expect(metadata.remainingMs).toBeLessThan(300_000);
    expect(metadata.warning).toBe(true);
    expect(metadata.expiresAt).toEqual(nearExpiry);
  });

  it('invalidateSession deletes the session and closes SSE clients for the user', async () => {
    const { sessionId } = await createSession(userId);
    const response = createMockResponse();
    sseManager.registerConnection(userId, response);
    expect(sseManager.getConnectionCount(userId)).toBe(1);

    await invalidateSession(sessionId);

    expect(await getSessionModel().findOne({ sessionId }).lean().exec()).toBeNull();
    expect(response.end).toHaveBeenCalled();
    expect(sseManager.getConnectionCount(userId)).toBe(0);
  });
});
