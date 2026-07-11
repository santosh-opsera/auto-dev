import './config/loadEnv.js';
import { validateEnv } from './config/validateEnv.js';
import express, { type Application, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  dbHealthConnectedSchema,
  dbHealthDisconnectedSchema,
  healthCheckSchema,
} from '@autodev/shared-types';
import { checkMongoHealth, connectMongo, disconnectMongo } from './database/connection.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import { standardRateLimitMiddleware } from './middleware/appRateLimits.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { validateBody } from './middleware/validateRequest.js';
import { sampleValidationPayloadSchema } from './fixtures/validation.js';
import { AppError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAuditRouter } from './routes/auditRoutes.js';
import { createConventionRouter } from './routes/conventionRoutes.js';
import { createEventRouter } from './routes/eventRoutes.js';
import { createTicketRouter } from './routes/ticketRoutes.js';
import { createRepositoryRouter } from './routes/repositoryRoutes.js';
import { createAnalysisRouter } from './routes/analysisRoutes.js';
import { requireConventionSettings } from './middleware/conventionGate.js';
import { requireSession, type AuthenticatedRequest } from './middleware/requireSession.js';
import { auditService } from './services/audit/auditService.js';
import { sampleAuditMutationPayload } from './fixtures/audit.js';
import { eventBus } from './services/events/eventBus.js';
import { domainEventSchema } from '@autodev/shared-types';

export function createApp(): Application {
  const app = express();

  app.use(corsMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(standardRateLimitMiddleware);
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
  app.use('/api/v1/audit', createAuditRouter());
  app.use('/api/v1/conventions', createConventionRouter());
  app.use('/api/v1/events', createEventRouter());
  app.use('/api/v1/tickets', createTicketRouter());
  app.use('/api/v1/repositories', createRepositoryRouter());
  app.use('/api/v1/repositories/:owner/:repo/analyze', createAnalysisRouter());

  if (process.env.NODE_ENV === 'test') {
    app.post(
      '/api/v1/test/validate',
      validateBody(sampleValidationPayloadSchema),
      (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      },
    );

    app.post(
      '/api/v1/test/workflow/start',
      asyncHandler(requireSession),
      asyncHandler(requireConventionSettings),
      (_req: AuthenticatedRequest, res: Response) => {
        res.status(200).json({ ok: true, message: 'Development workflow started.' });
      },
    );

    app.post(
      '/api/v1/test/mutation',
      asyncHandler(requireSession),
      asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        await auditService.log({
          resource: sampleAuditMutationPayload.resource,
          operation: 'create',
          actor: req.user ? String(req.user._id) : undefined,
          previousValue: sampleAuditMutationPayload.previousValue,
          newValue: sampleAuditMutationPayload.newValue,
          ipAddress: req.ip,
        });
        res.status(201).json({ ok: true });
      }),
    );

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

    app.post(
      '/api/v1/test/events/publish',
      asyncHandler(requireSession),
      asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const event = domainEventSchema.parse(req.body);
        await eventBus.publish(event, { awaitHandlers: true });
        res.status(202).json({ ok: true });
      }),
    );
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

function failStartup(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  logger.error(message, { resource: 'server', operation: 'startup' });
  process.exit(1);
}

if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
  } catch (error: unknown) {
    failStartup(error, 'Environment validation failed');
  }

  startServer().catch((error: unknown) => {
    failStartup(error, 'Server startup failed');
  });
}

export { connectMongo, disconnectMongo };
export { eventBus } from './services/events/eventBus.js';
