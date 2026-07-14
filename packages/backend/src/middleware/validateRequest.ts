import type { NextFunction, Request, Response } from 'express';
import { formatZodError, RequestValidationError } from '../utils/errors.js';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Duck-typed Zod schema. Avoid importing ZodType from the hoist zod@4
 * package, which is incompatible with shared-types’ zod@3 schemas.
 */
type SafeParseSchema<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: any };
};

function validatePart<T>(part: RequestPart, schema: SafeParseSchema<T>) {
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

export function validateBody<T>(schema: SafeParseSchema<T>) {
  return validatePart('body', schema);
}

export function validateQuery<T>(schema: SafeParseSchema<T>) {
  return validatePart('query', schema);
}

export function validateParams<T>(schema: SafeParseSchema<T>) {
  return validatePart('params', schema);
}
