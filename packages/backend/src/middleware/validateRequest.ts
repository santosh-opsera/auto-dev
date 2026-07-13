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

    // Express 5 exposes query (and sometimes params) as getters — redefine instead of assign.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
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
