import { randomUUID } from 'node:crypto';
import { SESSION_IDLE_MS, SESSION_WARNING_MS } from '../auth/constants.js';
import { encryptSecret, hashValue } from '@autodev/infrastructure';
import { getSessionModel, type SessionDocument } from '../models/sessionModel.js';
import { sseManager } from '../services/events/sseManager.js';

export interface SessionMetadata {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  remainingMs: number;
  warning: boolean;
}

export async function createSession(userId: string): Promise<{
  sessionId: string;
  refreshToken: string;
  metadata: SessionMetadata;
}> {
  const sessionId = randomUUID();
  const refreshToken = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);

  await getSessionModel().create({
    sessionId,
    userId,
    refreshTokenHash: hashValue(refreshToken),
    expiresAt,
    lastActivityAt: now,
    dataClassification: 'confidential',
  });

  return {
    sessionId,
    refreshToken,
    metadata: buildSessionMetadata(sessionId, userId, expiresAt),
  };
}

export async function getSessionById(sessionId: string): Promise<SessionDocument | null> {
  return getSessionModel().findOne({ sessionId }).exec();
}

/**
 * Deletes the session and closes any SSE clients owned by that user.
 * Security-sensitive: must tear down real-time streams when auth ends.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const session = await getSessionById(sessionId);
  await getSessionModel().deleteOne({ sessionId }).exec();

  if (session?.userId) {
    sseManager.closeUserConnections(String(session.userId));
  }
}

export async function rotateRefreshToken(
  sessionId: string,
  refreshToken: string,
): Promise<{ refreshToken: string; metadata: SessionMetadata } | null> {
  const session = await getSessionById(sessionId);

  if (!session || session.refreshTokenHash !== hashValue(refreshToken)) {
    return null;
  }

  const newRefreshToken = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);

  session.refreshTokenHash = hashValue(newRefreshToken);
  session.lastActivityAt = now;
  session.expiresAt = expiresAt;
  await (session as SessionDocument & { save: () => Promise<SessionDocument> }).save();

  return {
    refreshToken: newRefreshToken,
    metadata: buildSessionMetadata(sessionId, String(session.userId), expiresAt),
  };
}

/**
 * Atomically extends a non-expired session idle TTL.
 * Returns null when the session is missing or already expired (no write).
 */
export async function touchSession(sessionId: string): Promise<SessionMetadata | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);

  const session = await getSessionModel()
    .findOneAndUpdate(
      { sessionId, expiresAt: { $gt: now } },
      { $set: { lastActivityAt: now, expiresAt } },
      { returnDocument: 'after' },
    )
    .exec();

  if (!session) {
    return null;
  }

  return buildSessionMetadata(sessionId, String(session.userId), session.expiresAt);
}

export function buildSessionMetadata(
  sessionId: string,
  userId: string,
  expiresAt: Date,
): SessionMetadata {
  const remainingMs = Math.max(0, expiresAt.getTime() - Date.now());

  return {
    sessionId,
    userId,
    expiresAt,
    remainingMs,
    warning: remainingMs <= SESSION_WARNING_MS,
  };
}

export function encryptOAuthToken(token: string): string {
  return encryptSecret(token);
}
