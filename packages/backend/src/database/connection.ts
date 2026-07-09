import mongoose, { ConnectionStates } from 'mongoose';
import { logger } from '../utils/logger.js';

export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === ConnectionStates.connected) {
    return;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await mongoose.connect(uri);
      logger.info('MongoDB connected', {
        resource: 'mongodb',
        operation: 'connect',
      });
      return;
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      logger.error(`MongoDB connection attempt ${String(attempt + 1)} failed`, {
        resource: 'mongodb',
        operation: 'connect',
      });

      if (attempt < RETRY_DELAYS_MS.length - 1) {
        await sleep(delay);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MongoDB connection failed');
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState === ConnectionStates.disconnected) {
    return;
  }

  await mongoose.disconnect();
  logger.info('MongoDB disconnected', {
    resource: 'mongodb',
    operation: 'disconnect',
  });
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === ConnectionStates.connected;
}

export async function checkMongoHealth(): Promise<
  { status: 'connected'; latencyMs: number } | { status: 'disconnected'; error: string }
> {
  if (!isMongoConnected()) {
    return {
      status: 'disconnected',
      error: 'MongoDB is not connected',
    };
  }

  try {
    const startedAt = Date.now();
    await mongoose.connection.db?.admin().ping();
    return {
      status: 'connected',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MongoDB ping failed';
    return {
      status: 'disconnected',
      error: message,
    };
  }
}

export { mongoose };
