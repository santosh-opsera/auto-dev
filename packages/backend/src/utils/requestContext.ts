import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
  actor: string;
  resource: string;
  operation: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function updateRequestContext(partial: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (!current) {
    return;
  }

  Object.assign(current, partial);
}
