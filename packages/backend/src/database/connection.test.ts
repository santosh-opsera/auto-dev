import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo, RETRY_DELAYS_MS } from './connection.js';

describe('connectMongo', () => {
  beforeEach(async () => {
    await disconnectMongo();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await disconnectMongo();
  });

  it('uses exponential backoff delays of 1s, 2s, and 4s', () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
  });

  it('retries connection failures before succeeding', async () => {
    vi.useFakeTimers();

    const connectSpy = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('attempt 1 failed'))
      .mockRejectedValueOnce(new Error('attempt 2 failed'))
      .mockResolvedValueOnce(mongoose);

    const connectPromise = connectMongo('mongodb://localhost:27017/autodev-test');

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await connectPromise;

    expect(connectSpy).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('throws after exhausting retry attempts', async () => {
    vi.useFakeTimers();

    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('connection refused'));

    const connectPromise = connectMongo('mongodb://localhost:27017/autodev-test');
    const handled = connectPromise.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await handled;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('connection refused');

    vi.useRealTimers();
  });
});

describe('checkMongoHealth', () => {
  it('reports disconnected when MongoDB is not connected', async () => {
    await disconnectMongo();
    const { checkMongoHealth } = await import('./connection.js');
    const health = await checkMongoHealth();

    expect(health).toEqual({
      status: 'disconnected',
      error: 'MongoDB is not connected',
    });
  });
});
