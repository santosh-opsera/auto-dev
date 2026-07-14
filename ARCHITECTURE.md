# AutoDev Architecture

This document describes the backend architectural layers and the import rules enforced by `eslint-plugin-boundaries` (`npm run lint:boundaries`).

## Packages

| Package | Role |
|---------|------|
| `@autodev/backend` | Express API, domain services, Mongo models |
| `@autodev/frontend` | React + Vite UI |
| `@autodev/shared-types` | Shared Zod schemas / TypeScript types |
| `@autodev/infrastructure` | Cross-cutting primitives (CircuitBreaker, EventBus, encryption, BaseRepository, Clock, retry) |
| `@autodev/e2e` | API / UI end-to-end tests |

## Backend layer hierarchy

Dependencies flow **downward** only (higher layers may import lower layers; never upward):

```
controller (src/routes/)
    ↓
middleware (src/middleware/)  →  service (src/services/)
    ↓                                ↓
config (src/config/)           model / repository (src/models/, src/database/)
    ↓                                ↓
util (src/utils/, src/lib/)  ←→  @autodev/infrastructure / @autodev/shared-types
```

### Element types (ESLint)

| Type | Glob | Notes |
|------|------|-------|
| `controller` | `src/routes/**` | HTTP adapters |
| `service` | `src/services/**` | Domain / application services |
| `model` | `src/models/**` | Mongoose models |
| `repository` | `src/database/**` | Persistence helpers / schemas |
| `middleware` | `src/middleware/**` | Express middleware |
| `util` | `src/utils/**`, `src/lib/**` | Pure helpers |
| `config` | `src/config/**` | Env / bootstrap config |

Workspace packages such as `@autodev/infrastructure` are external to these folders and are the preferred home for shared, non-domain infrastructure.

## Disallowed imports (enforced as **error**)

Configured in `packages/backend/eslint.config.js` and `packages/backend/eslint.boundaries.config.js`:

- **service** → must not import **controller**
- **model** → must not import **service** or **controller**
- **repository** → must not import **controller**
- **util** → must not import **service** or **controller**

CI runs `npm run lint:boundaries` and fails the build on any violation.

## Adding a new module

1. Place the file under the correct `src/<layer>/` directory above.
2. Prefer extracting reusable, domain-agnostic helpers into `@autodev/infrastructure`.
3. Import workspace packages via their package name (`@autodev/...`), not deep relative paths across packages.
4. Run `npm run lint:boundaries` locally before opening a PR.

## Verification

```bash
npm run lint:boundaries
```
