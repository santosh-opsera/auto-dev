import type { Model } from 'mongoose';
import { logger } from '../utils/logger.js';

export async function ensureIndexes(models: Model<unknown>[]): Promise<void> {
  for (const model of models) {
    await model.syncIndexes();
    logger.info(`Synchronized indexes for ${model.collection.name}`, {
      resource: model.collection.name,
      operation: 'syncIndexes',
    });
  }
}
