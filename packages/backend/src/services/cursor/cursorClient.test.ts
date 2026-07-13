import { describe, expect, it } from 'vitest';
import {
  sampleCursorContextDocument,
  sampleCursorImplementationResult,
} from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';
import {
  createCursorClient,
  HttpCursorClient,
  InMemoryMockCursorClient,
  UnavailableCursorClient,
} from './cursorClient.js';

describe('CursorBridgeClient', () => {
  it('InMemoryMockCursorClient delivers context and returns scoped mock results', async () => {
    const client = new InMemoryMockCursorClient();
    const { delivery, result } = await client.deliver(sampleCursorContextDocument);

    expect(client.isAvailable()).toBe(true);
    expect(delivery.status).toBe('delivered');
    expect(client.delivered).toHaveLength(1);
    expect(result?.chunkId).toBe(sampleCursorContextDocument.chunkId);
    expect(result?.fileChanges.map((change) => change.path)).toEqual(
      sampleCursorContextDocument.guidance.filesToModify,
    );
  });

  it('InMemoryMockCursorClient supports dryRun without results', async () => {
    const client = new InMemoryMockCursorClient();
    const { delivery, result } = await client.deliver(sampleCursorContextDocument, {
      dryRun: true,
    });

    expect(delivery.status).toBe('dry_run');
    expect(result).toBeUndefined();
  });

  it('UnavailableCursorClient raises a clear CursorUnavailable error', async () => {
    const client = new UnavailableCursorClient();
    expect(client.isAvailable()).toBe(false);
    await expect(client.deliver(sampleCursorContextDocument)).rejects.toMatchObject({
      error: 'CursorUnavailable',
      statusCode: 503,
    } satisfies Partial<AppError>);
  });

  it('HttpCursorClient posts context to the bridge URL', async () => {
    const fetchFn = async (url: string, init: RequestInit) => {
      expect(url).toBe('https://cursor.example.com/v1/implement');
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body)) as { context: { chunkId: string } };
      expect(body.context.chunkId).toBe(sampleCursorContextDocument.chunkId);

      return {
        status: 200,
        json: async () => ({
          deliveryId: 'del-1',
          status: 'delivered',
          result: sampleCursorImplementationResult,
        }),
        text: async () => '',
      };
    };

    const client = new HttpCursorClient('https://cursor.example.com', fetchFn);
    const { delivery, result } = await client.deliver(sampleCursorContextDocument);

    expect(delivery.deliveryId).toBe('del-1');
    expect(result?.summary).toBe(sampleCursorImplementationResult.summary);
  });

  it('createCursorClient uses mock in test when CURSOR_BRIDGE_URL is unset', () => {
    const previous = process.env.CURSOR_BRIDGE_URL;
    delete process.env.CURSOR_BRIDGE_URL;
    const client = createCursorClient();
    expect(client).toBeInstanceOf(InMemoryMockCursorClient);
    if (previous === undefined) {
      delete process.env.CURSOR_BRIDGE_URL;
    } else {
      process.env.CURSOR_BRIDGE_URL = previous;
    }
  });
});
