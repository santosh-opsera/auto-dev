# @autodev/infrastructure

Shared runtime primitives for AutoDev packages. Prefer these exports over ad-hoc copies of circuit breakers, retry loops, event buses, encryption helpers, or repository bases.

## Overview

| Module | Purpose |
|--------|---------|
| `CircuitBreaker` | Three-state failure gating for outbound integrations |
| `EventBus` / `eventBus` | Typed domain-event publish/subscribe with Zod validation |
| Encryption | AES-256-GCM secrets, confidential fields, per-record DEK erasure |
| `BaseRepository` | Generic Mongoose CRUD with audit actor fields |
| `Clock` / `systemClock` | Injectable clock for retention / GDPR scheduling |
| Retry | `withRetry`, `sleep`, `isRetryableHttpStatus` |

Depends on `@autodev/shared-types`. `BaseRepository` requires a **mongoose** peer dependency (`^9.7.4`).

## Installation

This package is part of the monorepo workspaces. From the repo root:

```bash
npm install
```

Consumers declare:

```json
{
  "dependencies": {
    "@autodev/infrastructure": "*",
    "@autodev/shared-types": "*"
  },
  "peerDependencies": {
    "mongoose": "^9.7.4"
  }
}
```

## Quick start

```ts
import {
  CircuitBreaker,
  eventBus,
  withRetry,
  type Logger,
} from '@autodev/infrastructure';

const breaker = new CircuitBreaker(5, 60_000, 30_000);

if (breaker.canExecute()) {
  try {
    await withRetry(() => fetchUpstream(), [1000, 2000, 4000], {
      shouldRetry: (error) => /* inspect status */ true,
    });
    breaker.recordSuccess();
  } catch (error) {
    breaker.recordFailure();
    throw error;
  }
}

const hostLogger: Logger = {
  info: (message, meta) => console.log(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  error: (message, meta) => console.error(message, meta),
};
eventBus.setLogger(hostLogger);

eventBus.subscribe('PR_CREATED', async (event) => {
  // handle domain event
  void event;
});
```

## Configuration

### Encryption — `ENCRYPTION_KEY`

Encryption helpers derive a 256-bit KEK from:

1. An explicit `encryptionKey` argument to `getKek` / encrypt helpers, or
2. `process.env.ENCRYPTION_KEY`, or
3. A **dev-only** default (never use in production).

Set a strong secret in every non-dev environment:

```bash
ENCRYPTION_KEY=replace-with-a-long-random-secret
```

### EventBus — `Logger` contract

```ts
interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

Wire the host logger at bootstrap (`eventBus.setLogger(logger)`). Until then, `noopLogger` is used so handler failures still do not crash the process.

### BaseRepository — mongoose peer

`BaseRepository` imports types from `mongoose`. Install mongoose in the consuming package (backend already does).

## API reference

### CircuitBreaker

```ts
new CircuitBreaker(
  failureThreshold = 5,
  windowMs = 60_000,
  openDurationMs = 30_000,
  now = Date.now,
)
```

| Method | Description |
|--------|-------------|
| `getState()` | `'closed' \| 'open' \| 'half-open'` |
| `canExecute()` | `true` when closed or half-open |
| `getRetryAfterSeconds()` | Seconds until half-open when open |
| `recordSuccess()` | Reset to closed |
| `recordFailure()` | Count failure; may open the breaker |

### EventBus

| API | Description |
|-----|-------------|
| `new EventBus(logger?)` | Construct a bus (tests) |
| `eventBus` | Process-wide singleton |
| `subscribe(type, handler)` | Register handler |
| `unsubscribe(type, handler)` | Remove handler |
| `publish(event, { awaitHandlers? })` | Validate + dispatch (Zod) |
| `getHistory()` / `clearHistory()` | Last 100 events buffer |
| `setLogger(logger)` | Host logger injection |

### Encryption

| Function | Description |
|----------|-------------|
| `encryptSecret` / `decryptSecret` | Restricted AES-256-GCM |
| `encryptOAuthToken` / `decryptOAuthToken` | Aliases of secret helpers |
| `encryptConfidentialField(s)` | Purpose-bound field encryption |
| `encryptWithPerRecordDek` / `decryptWithPerRecordDek` | Per-record DEK + wrapped KEK |
| `cryptographicallyErase` / `cryptographicallyEraseSecret` | Destroy wrapped DEK |
| `wrapDek` / `unwrapDek` | DEK wrapping primitives |
| `getKek(key?)` | Resolve KEK buffer |
| `hashValue` | SHA-256 hex digest |

### BaseRepository\<T extends AuditFields\>

| Method | Description |
|--------|-------------|
| `findById` / `findOne` | Lookup |
| `create(data, actorId?)` | Insert with `createdBy`/`updatedBy` |
| `updateById` | Patch with `updatedBy` |
| `deleteById` | Hard delete |

`AuditFields` includes `createdAt`, `updatedAt`, optional actors, and `dataClassification`.

### Clock

```ts
type Clock = () => Date;
const systemClock: Clock; // () => new Date()
```

Inject alternate clocks in retention / GDPR jobs for deterministic tests.

### Retry

| Export | Description |
|--------|-------------|
| `DEFAULT_RETRY_DELAYS_MS` | `[1000, 2000, 4000]` |
| `withRetry(op, delays?, options?)` | Retry loop; length of `delays` = max attempts |
| `sleep(ms)` | Promise delay |
| `isRetryableHttpStatus(status)` | `429` or `>= 500` |

## Usage examples

### GitHub-style retry delays

```ts
await withRetry(callGitHub, [1000, 2000, 4000], {
  shouldRetry: (error) => isRetryableHttpStatus(statusFrom(error)),
});
```

### Per-record encryption + erasure

```ts
const payload = encryptWithPerRecordDek(JSON.stringify(profile));
// … persist payload.ciphertext + payload.wrappedDek …
const erased = cryptographicallyEraseSecret(payload);
```

## Scripts

```bash
npm run build -w @autodev/infrastructure
npm run test -w @autodev/infrastructure
```
