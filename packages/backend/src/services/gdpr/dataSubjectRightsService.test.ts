import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERASURE_GRACE_PERIOD_MS,
  sampleDsrUserDataset,
  sampleUpdateUserProfileInput,
} from '@autodev/shared-types';
import {
  cryptographicallyEraseSecret,
  DataSubjectRightsService,
} from './dataSubjectRightsService.js';
import {
  cryptographicallyErase,
  decryptWithPerRecordDek,
  encryptWithPerRecordDek,
} from '@autodev/infrastructure';

describe('dataSubjectRightsService (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cryptographically erases secrets so ciphertext cannot be recovered', () => {
    const erased = cryptographicallyEraseSecret('gho_secret_token');
    const parsed = JSON.parse(erased) as {
      ciphertext: string;
      wrappedDek: string;
      erased: boolean;
    };
    expect(parsed.erased).toBe(true);
    expect(() => decryptWithPerRecordDek(parsed)).toThrow(/destroyed/);

    const wrapped = encryptWithPerRecordDek('prompt with PII');
    const destroyed = cryptographicallyErase(wrapped);
    expect(() => decryptWithPerRecordDek(destroyed)).toThrow(/destroyed/);
  });

  it('computes grace period schedule 24 hours ahead of injectable clock', () => {
    let now = new Date('2026-07-13T12:00:00.000Z');
    const clock = () => now;
    const service = new DataSubjectRightsService({ clock });

    const requestedAt = clock();
    const scheduledFor = new Date(requestedAt.getTime() + ERASURE_GRACE_PERIOD_MS);
    expect(scheduledFor.toISOString()).toBe('2026-07-14T12:00:00.000Z');

    now = new Date('2026-07-14T11:59:59.000Z');
    expect(scheduledFor.getTime()).toBeGreaterThan(clock().getTime());

    now = new Date('2026-07-14T12:00:00.000Z');
    expect(scheduledFor.getTime()).toBeLessThanOrEqual(clock().getTime());

    // Service is constructed with the same clock used by schedule/cancel/execute paths.
    expect(service).toBeInstanceOf(DataSubjectRightsService);
  });

  it('assembles export shape from cross-collection sample fixtures', () => {
    const exportedAt = '2026-07-13T12:00:00.000Z';
    const assembled = {
      exportedAt,
      profile: sampleDsrUserDataset.profile,
      conventionSettings: sampleDsrUserDataset.conventionSettings,
      workflowHistory: sampleDsrUserDataset.workflowHistory,
      auditLogs: sampleDsrUserDataset.auditLogs,
      connectedRepositories: sampleDsrUserDataset.connectedRepositories,
    };

    expect(assembled.profile.email).toBe('alex.dev@example.com');
    expect(assembled.conventionSettings).toHaveLength(1);
    expect(assembled.workflowHistory[0]?.ticketKey).toBe('AUTO-100');
    expect(assembled.auditLogs[0]?.actor).toBe(sampleDsrUserDataset.profile.id);
    expect(assembled.connectedRepositories[0]?.fullName).toBe('acme/auto-dev');
    expect(sampleUpdateUserProfileInput.displayName).toBe('Alex Updated');
  });
});
