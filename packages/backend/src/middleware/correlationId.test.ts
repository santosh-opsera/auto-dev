import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { CORRELATION_ID_HEADER, correlationIdMiddleware } from './correlationId.js';
import { logger, parseLogLine, resetLogWriter, setLogWriter } from '../utils/logger.js';

describe('correlationIdMiddleware', () => {
  it('generates a correlation ID when header is missing', async () => {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBeTruthy();
  });

  it('reuses client-provided X-Correlation-ID header', async () => {
    const app = express();
    const lines: string[] = [];

    setLogWriter((line) => {
      lines.push(line);
    });

    app.use(correlationIdMiddleware);
    app.get('/test', (_req, res) => {
      logger.info('Handled request');
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get('/test')
      .set(CORRELATION_ID_HEADER, 'client-correlation-99');

    expect(response.headers['x-correlation-id']).toBe('client-correlation-99');

    const entry = parseLogLine(lines[0] ?? '');
    expect(entry.correlationId).toBe('client-correlation-99');

    resetLogWriter();
  });
});
