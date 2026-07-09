import express, { type Application, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  dbHealthConnectedSchema,
  dbHealthDisconnectedSchema,
  healthCheckSchema,
} from '@autodev/shared-types';
import { checkMongoHealth, connectMongo, disconnectMongo } from './database/connection.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { createAuthRouter } from './routes/authRoutes.js';

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());
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

  app.get('/api/v1/health/db', async (_req: Request, res: Response) => {
    const health = await checkMongoHealth();

    if (health.status === 'connected') {
      const payload = dbHealthConnectedSchema.parse(health);
      logger.info('Database health check succeeded', {
        resource: '/api/v1/health/db',
        operation: 'GET',
      });
      res.json(payload);
      return;
    }

    const payload = dbHealthDisconnectedSchema.parse(health);
    logger.warn('Database health check failed', {
      resource: '/api/v1/health/db',
      operation: 'GET',
    });
    res.status(503).json(payload);
  });

  app.use('/api/v1/auth', createAuthRouter());

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

async function startServer(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    await connectMongo(mongoUri);
  } else {
    logger.warn('MONGODB_URI is not configured; database features are disabled', {
      resource: 'mongodb',
      operation: 'startup',
    });
  }

  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
      resource: 'server',
      operation: 'startup',
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Server startup failed';
    logger.error(message, {
      resource: 'server',
      operation: 'startup',
    });
    process.exit(1);
  });
}

export { connectMongo, disconnectMongo };
