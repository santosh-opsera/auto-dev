import { randomUUID } from 'node:crypto';
import type {
  CursorContextDocument,
  CursorDeliveryAck,
  CursorImplementationResult,
} from '@autodev/shared-types';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { AppError } from '../../utils/errors.js';

export interface CursorDeliverOptions {
  dryRun?: boolean;
}

export interface CursorBridgeClient {
  isAvailable(): boolean;
  deliver(
    context: CursorContextDocument,
    options?: CursorDeliverOptions,
  ): Promise<{
    delivery: CursorDeliveryAck;
    result?: CursorImplementationResult;
  }>;
}

export type CursorFetchFn = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

const defaultFetch: CursorFetchFn = async (url, init) => {
  assertAllowedUrl(url);
  const response = await fetch(url, init);
  return {
    status: response.status,
    json: () => response.json() as Promise<unknown>,
    text: () => response.text(),
  };
};

function unavailableError(): AppError {
  return new AppError(
    'CursorUnavailable',
    'Cursor IDE bridge is unavailable. CURSOR_BRIDGE_URL is not configured or the Cursor extension/MCP endpoint is unreachable.',
    503,
    'Set CURSOR_BRIDGE_URL to your Cursor bridge endpoint, ensure the Cursor IDE extension or MCP server is running and reachable, add its host to SSRF_ALLOWED_HOSTS if needed, then retry. Integration tests use InMemoryMockCursorClient automatically when CURSOR_BRIDGE_URL is unset.',
  );
}

/** HTTP client for real Cursor extension / MCP bridge endpoints. */
export class HttpCursorClient implements CursorBridgeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: CursorFetchFn = defaultFetch,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.baseUrl.trim());
  }

  async deliver(
    context: CursorContextDocument,
    options: CursorDeliverOptions = {},
  ): Promise<{ delivery: CursorDeliveryAck; result?: CursorImplementationResult }> {
    if (!this.isAvailable()) {
      throw unavailableError();
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/implement`;
    let response: { status: number; json: () => Promise<unknown>; text: () => Promise<string> };

    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          dryRun: options.dryRun === true,
        }),
      });
    } catch {
      throw unavailableError();
    }

    if (response.status >= 500 || response.status === 0) {
      throw unavailableError();
    }

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await response.text().catch(() => '');
      throw new AppError(
        'CursorDeliveryFailed',
        `Cursor IDE bridge rejected the implementation request (HTTP ${String(response.status)}).`,
        502,
        bodyText
          ? `Review the Cursor bridge response and retry. Detail: ${bodyText.slice(0, 200)}`
          : 'Verify CURSOR_BRIDGE_URL and Cursor extension health, then retry.',
      );
    }

    const body = (await response.json()) as {
      deliveryId?: string;
      status?: CursorDeliveryAck['status'];
      result?: CursorImplementationResult;
    };

    const delivery: CursorDeliveryAck = {
      deliveryId: body.deliveryId ?? randomUUID(),
      status: options.dryRun ? 'dry_run' : (body.status ?? 'delivered'),
      deliveredAt: new Date().toISOString(),
    };

    return { delivery, result: body.result };
  }
}

export interface InMemoryMockCursorClientOptions {
  /** When set, deliver returns this result (paths rewritten to match chunk scope when empty). */
  resultFactory?: (context: CursorContextDocument) => CursorImplementationResult;
  /** Simulate unavailable bridge. */
  available?: boolean;
}

/** In-memory mock used in tests and when CURSOR_BRIDGE_URL is unset under NODE_ENV=test. */
export class InMemoryMockCursorClient implements CursorBridgeClient {
  readonly delivered: CursorContextDocument[] = [];
  private readonly available: boolean;
  private readonly resultFactory: (context: CursorContextDocument) => CursorImplementationResult;

  constructor(options: InMemoryMockCursorClientOptions = {}) {
    this.available = options.available ?? true;
    this.resultFactory =
      options.resultFactory ??
      ((context) => ({
        chunkId: context.chunkId,
        workflowId: context.workflowId,
        branchName: `feature/${context.ticketIntent.ticketKey}`,
        commitMessage: `${context.ticketIntent.ticketKey}: ${context.chunk.name}`,
        fileChanges: context.guidance.filesToModify.map((path) => ({
          path,
          action: 'modified' as const,
          content: `// mock implementation for ${path}\n`,
        })),
        newFiles: [],
        deletedFiles: [],
        summary: `Mock Cursor implementation for chunk ${context.chunk.name}`,
        receivedAt: new Date().toISOString(),
      }));
  }

  isAvailable(): boolean {
    return this.available;
  }

  async deliver(
    context: CursorContextDocument,
    options: CursorDeliverOptions = {},
  ): Promise<{ delivery: CursorDeliveryAck; result?: CursorImplementationResult }> {
    if (!this.available) {
      throw unavailableError();
    }

    this.delivered.push(context);

    const delivery: CursorDeliveryAck = {
      deliveryId: randomUUID(),
      status: options.dryRun ? 'dry_run' : 'delivered',
      deliveredAt: new Date().toISOString(),
    };

    if (options.dryRun) {
      return { delivery };
    }

    return {
      delivery,
      result: this.resultFactory(context),
    };
  }

  clear(): void {
    this.delivered.length = 0;
  }
}

/** Client that always reports unavailable — used in non-test envs without CURSOR_BRIDGE_URL. */
export class UnavailableCursorClient implements CursorBridgeClient {
  isAvailable(): boolean {
    return false;
  }

  async deliver(
    _context: CursorContextDocument,
    _options?: CursorDeliverOptions,
  ): Promise<never> {
    throw unavailableError();
  }
}

export function createCursorClient(
  fetchFn: CursorFetchFn = defaultFetch,
): CursorBridgeClient {
  const bridgeUrl = process.env.CURSOR_BRIDGE_URL?.trim();

  if (bridgeUrl) {
    return new HttpCursorClient(bridgeUrl, fetchFn);
  }

  if (process.env.NODE_ENV === 'test') {
    return new InMemoryMockCursorClient();
  }

  return new UnavailableCursorClient();
}

export { unavailableError as cursorUnavailableError };
