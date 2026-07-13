import { describe, expect, it } from 'vitest';
import {
  cancelErasureResponseSchema,
  dataExportResponseSchema,
  ERASURE_GRACE_PERIOD_MS,
  erasureExecutionSummarySchema,
  erasureScheduleResponseSchema,
  scheduleErasureSchema,
  updateUserProfileSchema,
} from './gdprDsr.js';
import {
  sampleCancelErasureResponse,
  sampleDataExportResponse,
  sampleErasureExecutionSummary,
  sampleErasureScheduleResponse,
  sampleUpdateUserProfileInput,
} from './fixtures/gdprDsr.js';

describe('gdprDsr schemas', () => {
  it('validates profile update input and rejects invalid email', () => {
    expect(updateUserProfileSchema.safeParse(sampleUpdateUserProfileInput).success).toBe(true);
    expect(
      updateUserProfileSchema.safeParse({ displayName: 'x', email: 'not-an-email' }).success,
    ).toBe(false);
    expect(updateUserProfileSchema.safeParse({ displayName: '', email: 'a@b.com' }).success).toBe(
      false,
    );
  });

  it('validates data export fixture and erasure confirmation payload', () => {
    expect(dataExportResponseSchema.safeParse(sampleDataExportResponse).success).toBe(true);
    expect(
      scheduleErasureSchema.safeParse({ confirmationEmail: 'alex.dev@example.com' }).success,
    ).toBe(true);
    expect(scheduleErasureSchema.safeParse({ confirmationEmail: 'bad' }).success).toBe(false);
  });

  it('validates erasure schedule / cancel / execution fixtures with 24h grace', () => {
    expect(ERASURE_GRACE_PERIOD_MS).toBe(24 * 60 * 60 * 1000);
    expect(erasureScheduleResponseSchema.safeParse(sampleErasureScheduleResponse).success).toBe(
      true,
    );
    expect(cancelErasureResponseSchema.safeParse(sampleCancelErasureResponse).success).toBe(true);
    expect(erasureExecutionSummarySchema.safeParse(sampleErasureExecutionSummary).success).toBe(
      true,
    );
  });
});
