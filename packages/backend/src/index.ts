import express, { type Application, type Request, type Response } from 'express';
import { healthCheckSchema } from '@autodev/shared-types';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(correlationIdMiddleware);

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const payload = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };

    healthCheckSchema.parse(payload);
    logger.info('Health check endpoint called', {
      resource: '/api/v1/health',
      operation: 'GET',
    });
    res.json(payload);
  });

  if (process.env.NODE_ENV === 'test') {
    app.get('/api/v1/test/error', () => {
      throw new Error('Unexpected failure at /app/src/test.ts:10:5');
    });

    app.get('/api/v1/test/app-error', (_req: Request, _res: Response) => {
      throw new AppError(
        'ValidationError',
        'The request payload is invalid.',
        400,
        'Review the request fields and try again.',
      );
    });
  }

  app.use(errorHandler);

  return app;
}

const PORT = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      resource: 'server',
      operation: 'startup',
    });
  });
}
