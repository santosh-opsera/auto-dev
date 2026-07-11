import { describe, expect, it } from 'vitest';
import { sampleErrorObjects, sampleRequestContext } from '../fixtures/logging.js';
import { AppError, RequestValidationError, sanitizeErrorMessage, toErrorResponse } from './errors.js';

describe('errors', () => {
  it('maps AppError to structured response', () => {
    const err = new AppError(
      'ValidationError',
      'Invalid payload',
      400,
      'Fix the payload and retry.',
    );

    const result = toErrorResponse(err, 'support-123');

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({
      error: 'ValidationError',
      message: 'Invalid payload',
      supportReferenceId: 'support-123',
      suggestedAction: 'Fix the payload and retry.',
    });
  });

  it('maps RequestValidationError to structured field errors', () => {
    const err = new RequestValidationError([
      { path: 'name', message: 'Name is required' },
    ]);

    const result = toErrorResponse(err, 'support-validation');

    expect(result.statusCode).toBe(400);
    expect(result.body).toMatchObject({
      error: 'ValidationError',
      fields: [{ path: 'name', message: 'Name is required' }],
    });
  });

  it('sanitizes unknown errors without exposing internal paths', () => {
    const result = toErrorResponse(sampleErrorObjects.internal, 'support-456');

    expect(result.statusCode).toBe(500);
    expect(result.body.message).not.toContain('/app/src');
    expect(result.body.message).not.toContain('TypeError');
    expect(JSON.stringify(result.body)).not.toContain('stack');
    expect(result.body).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred. Please try again later.',
      supportReferenceId: 'support-456',
      suggestedAction: 'Contact support with the reference ID if the problem persists.',
    });
  });

  it('sanitizes error messages for unknown errors', () => {
    expect(sanitizeErrorMessage(sampleErrorObjects.internal)).toBe(
      'An unexpected error occurred. Please try again later.',
    );
    expect(sanitizeErrorMessage(new AppError('NotFound', 'Missing item', 404, 'Retry'))).toBe(
      'Missing item',
    );
  });

  it('uses fixture request context values in downstream logging scenarios', () => {
    expect(sampleRequestContext.correlationId).toBe('corr-fixture-001');
    expect(sampleRequestContext.actor).toBe('user@example.com');
  });
});
