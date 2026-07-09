import { randomUUID } from 'node:crypto';
import type { ErrorResponse } from '@autodev/shared-types';

export class AppError extends Error {
  constructor(
    public readonly error: string,
    message: string,
    public readonly statusCode: number,
    public readonly suggestedAction: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createSupportReferenceId(): string {
  return randomUUID();
}

export function toErrorResponse(err: unknown, supportReferenceId = createSupportReferenceId()): {
  statusCode: number;
  body: ErrorResponse;
} {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: err.error,
        message: err.message,
        supportReferenceId,
        suggestedAction: err.suggestedAction,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: 'InternalServerError',
      message: 'An unexpected error occurred. Please try again later.',
      supportReferenceId,
      suggestedAction: 'Contact support with the reference ID if the problem persists.',
    },
  };
}

export function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof AppError) {
    return err.message;
  }

  if (err instanceof Error) {
    return 'An unexpected error occurred. Please try again later.';
  }

  return 'An unexpected error occurred. Please try again later.';
}
