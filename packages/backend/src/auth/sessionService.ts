import { randomUUID } from 'node:crypto';
import { SESSION_IDLE_MS, SESSION_WARNING_MS } from '../auth/constants.js';
import { encryptSecret, hashValue } from '../lib/encryption.js';
import { getSessionModel, type SessionDocument } from '../models/sessionModel.js';

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

export async function invalidateSession(sessionId: string): Promise<void> {
  await getSessionModel().deleteOne({ sessionId }).exec();
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

export async function touchSession(sessionId: string): Promise<SessionMetadata | null> {
  const session = await getSessionById(sessionId);

  if (!session) {
    return null;
  }

  const now = new Date();
  session.lastActivityAt = now;
  session.expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
  await (session as SessionDocument & { save: () => Promise<SessionDocument> }).save();

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
