import express, { type Application, type Request, type Response } from 'express';
import { healthCheckSchema } from '@autodev/shared-types';
import { logger } from './utils/logger.js';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const payload = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };

    healthCheckSchema.parse(payload);
    logger.info('Health check endpoint called');
    res.json(payload);
  });

  return app;
}

const PORT = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}
