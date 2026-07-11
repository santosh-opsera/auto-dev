import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { formatZodError, RequestValidationError } from '../utils/errors.js';

type RequestPart = 'body' | 'query' | 'params';

function validatePart<T>(part: RequestPart, schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new RequestValidationError(formatZodError(result.error)));
      return;
    }

    req[part] = result.data as Request[typeof part];
    next();
  };
}

export function validateBody<T>(schema: ZodType<T>) {
  return validatePart('body', schema);
}

export function validateQuery<T>(schema: ZodType<T>) {
  return validatePart('query', schema);
}

export function validateParams<T>(schema: ZodType<T>) {
  return validatePart('params', schema);
}
