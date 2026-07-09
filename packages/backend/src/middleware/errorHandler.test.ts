import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorResponseSchema, type ErrorResponse } from '@autodev/shared-types';
import { correlationIdMiddleware } from './correlationId.js';
import { errorHandler } from './errorHandler.js';
import { AppError } from '../utils/errors.js';
import { logger, parseLogLine, resetLogWriter, setLogWriter } from '../utils/logger.js';

describe('errorHandler', () => {
  afterEach(() => {
    resetLogWriter();
  });

  it('returns structured 500 responses without stack traces', async () => {
    const app = express();
    const lines: string[] = [];

    setLogWriter((line) => {
      lines.push(line);
    });

    app.use(correlationIdMiddleware);
    app.get('/boom', () => {
      throw new Error('Sensitive /internal/path failure');
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(errorResponseSchema.parse(response.body)).toEqual(response.body);
    expect(JSON.stringify(response.body)).not.toContain('/internal/path');
    expect(JSON.stringify(response.body)).not.toContain('stack');

    const entry = parseLogLine(lines[0] ?? '');
    expect(entry.level).toBe('error');
  });

  it('returns structured AppError responses', async () => {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/invalid', () => {
      throw new AppError(
        'ValidationError',
        'Invalid payload',
        422,
        'Review the submitted fields.',
      );
    });
    app.use(errorHandler);

    const response = await request(app).get('/invalid');
    const body: ErrorResponse = errorResponseSchema.parse(response.body);

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      error: 'ValidationError',
      message: 'Invalid payload',
      suggestedAction: 'Review the submitted fields.',
    });
    expect(typeof body.supportReferenceId).toBe('string');
  });

  it('always logs caught exceptions at error level', async () => {
    const app = express();
    const lines: string[] = [];

    setLogWriter((line, level) => {
      lines.push(`${level}:${line}`);
    });

    app.get('/fail', () => {
      try {
        throw new Error('Handled downstream');
      } catch (error) {
        logger.error('Caught exception during processing');
        throw error;
      }
    });
    app.use(errorHandler);

    await request(app).get('/fail');

    expect(lines.some((line) => line.startsWith('error:'))).toBe(true);
  });
});
