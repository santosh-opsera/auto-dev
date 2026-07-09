import { afterEach, describe, expect, it } from 'vitest';
import { sampleRequestContext } from '../fixtures/logging.js';
import { logger, parseLogLine, resetLogWriter, setLogWriter } from './logger.js';
import { runWithRequestContext } from './requestContext.js';

describe('logger', () => {
  const lines: string[] = [];

  afterEach(() => {
    lines.length = 0;
    resetLogWriter();
  });

  it('writes JSON logs with required fields', () => {
    setLogWriter((line) => {
      lines.push(line);
    });

    logger.info('Health check completed', {
      actor: 'system',
      resource: '/api/v1/health',
      operation: 'GET',
    });

    expect(lines).toHaveLength(1);
    const entry = parseLogLine(lines[0] ?? '');

    expect(entry).toMatchObject({
      level: 'info',
      correlationId: 'no-correlation-id',
      actor: 'system',
      resource: '/api/v1/health',
      operation: 'GET',
      message: 'Health check completed',
    });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('threads correlation ID from request context', () => {
    setLogWriter((line) => {
      lines.push(line);
    });

    runWithRequestContext(sampleRequestContext, () => {
      logger.warn('Workflow validation failed');
    });

    const entry = parseLogLine(lines[0] ?? '');
    expect(entry.correlationId).toBe('corr-fixture-001');
    expect(entry.actor).toBe('user@example.com');
    expect(entry.resource).toBe('/api/v1/workflows');
    expect(entry.operation).toBe('POST');
  });

  it('logs errors at error level without swallowing exceptions', () => {
    setLogWriter((line, level) => {
      lines.push(`${level}:${line}`);
    });

    logger.error('Request failed', {
      resource: 'error-handler',
      operation: 'handleError',
    });

    expect(lines[0]).toMatch(/^error:/);
    const entry = parseLogLine(lines[0]?.replace(/^error:/, '') ?? '');
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('Request failed');
  });
});
