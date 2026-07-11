import { randomUUID } from 'node:crypto';
import type { ErrorResponse, FieldValidationError } from '@autodev/shared-types';
import type { ZodError } from 'zod';

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

export class RequestValidationError extends AppError {
  constructor(public readonly fields: FieldValidationError[]) {
    super(
      'ValidationError',
      'Request validation failed.',
      400,
      'Review the field errors and correct the request payload.',
    );
    this.name = 'RequestValidationError';
  }
}

export function formatZodError(error: ZodError): FieldValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}

export function createSupportReferenceId(): string {
  return randomUUID();
}

export function toErrorResponse(err: unknown, supportReferenceId = createSupportReferenceId()): {
  statusCode: number;
  body: ErrorResponse | (ErrorResponse & { fields: FieldValidationError[] });
} {
  if (err instanceof RequestValidationError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: err.error,
        message: err.message,
        supportReferenceId,
        suggestedAction: err.suggestedAction,
        fields: err.fields,
      },
    };
  }

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
