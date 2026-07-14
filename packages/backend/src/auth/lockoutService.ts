import { LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS } from './constants.js';
import {
  buildLockoutExpiry,
  buildLockoutWindowExpiry,
  getLockoutModel,
  type LockoutDocument,
} from '../models/lockoutModel.js';

export type LockoutResult = { locked: boolean; remainingAttempts: number };

function toMillis(value: Date | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? value : value.getTime();
}

function isActivelyLocked(entry: Pick<LockoutDocument, 'lockedUntil'>, now: number): boolean {
  const lockedUntil = toMillis(entry.lockedUntil);
  return lockedUntil !== undefined && lockedUntil > now;
}

export async function recordAuthFailure(key: string): Promise<LockoutResult> {
  const now = Date.now();
  const model = getLockoutModel();
  const existing = await model.findOne({ key }).lean().exec();

  if (existing && isActivelyLocked(existing, now)) {
    return { locked: true, remainingAttempts: 0 };
  }

  const windowExpired =
    !existing || now - existing.firstFailureAt.getTime() > LOCKOUT_WINDOW_MS;

  const failures = windowExpired ? 1 : existing.failures + 1;
  const firstFailureAt = windowExpired ? new Date(now) : existing.firstFailureAt;

  if (failures >= LOCKOUT_THRESHOLD) {
    const lockedUntil = new Date(now + LOCKOUT_WINDOW_MS);
    await model
      .findOneAndUpdate(
        { key },
        {
          $set: {
            failures,
            firstFailureAt,
            lockedUntil,
            expiresAt: buildLockoutExpiry(lockedUntil),
            dataClassification: 'internal',
          },
          $setOnInsert: { key },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    return { locked: true, remainingAttempts: 0 };
  }

  await model
    .findOneAndUpdate(
      { key },
      {
        $set: {
          failures,
          firstFailureAt,
          expiresAt: buildLockoutWindowExpiry(firstFailureAt),
          dataClassification: 'internal',
        },
        $unset: { lockedUntil: 1 },
        $setOnInsert: { key },
      },
      { upsert: true, returnDocument: 'after' },
    )
    .exec();

  return {
    locked: false,
    remainingAttempts: LOCKOUT_THRESHOLD - failures,
  };
}

export async function clearAuthFailures(key: string): Promise<void> {
  await getLockoutModel().deleteOne({ key }).exec();
}

export async function isLockedOut(key: string): Promise<boolean> {
  const entry = await getLockoutModel().findOne({ key }).lean().exec();
  if (!entry?.lockedUntil) {
    return false;
  }

  const lockedUntil = entry.lockedUntil.getTime();
  if (lockedUntil <= Date.now()) {
    await getLockoutModel().deleteOne({ key }).exec();
    return false;
  }

  return true;
}

/** Test helper — clears all lockout documents. */
export async function resetLockouts(): Promise<void> {
  await getLockoutModel().deleteMany({}).exec();
}
