# AutoDev E2E Suite (WO-039)

End-to-end coverage for core workflows in **mock mode** — no Docker Compose or real OAuth secrets required.

## What it covers

| Flow | API (vitest + supertest) | UI (Playwright) |
|------|--------------------------|-----------------|
| Auth: OAuth login → session → heartbeat → warning → logout | yes | smoke + session warning modal |
| Convention setup wizard + prerequisite gate | yes | wizard walk + save |
| Ticket ingestion: select → parse → gaps → resolve → proceed | yes | parse happy path + gaps |
| Approval gate: divergences → decide → clear | yes | compare + resolve + proceed |
| Express mocks for GitHub / Jira / LLM | yes | n/a (fixture servers) |

## Quick start

```bash
# from repo root
npm install
npm run install:browsers -w @autodev/e2e   # once
npm run test:e2e                           # API + UI (< 5 min target)
```

### API only (fastest)

```bash
npm run test:e2e:api
```

Uses in-process `createApp()` + MongoMemoryServer. OAuth token exchange is stubbed (same pattern as backend route tests).

### UI only

```bash
npm run test:e2e:ui
```

Builds are not required — Playwright starts the Vite **dev** server and stubs `/api/v1/*` via route interception (seeded session cookies are not required).

### Mock fixture servers (optional)

Stand up Express fixtures that return committed GitHub / Jira / LLM payloads:

```bash
npm run test:e2e:mocks
# → http://127.0.0.1:9101  GitHub
# → http://127.0.0.1:9102  Jira
# → http://127.0.0.1:9103  LLM
```

Ports are overridable with `E2E_MOCK_GITHUB_PORT`, `E2E_MOCK_JIRA_PORT`, `E2E_MOCK_LLM_PORT`.

## Reports

- API JSON: `packages/e2e/test-results/api-results.json`
- Playwright HTML: `packages/e2e/playwright-report/` (`npm run report -w @autodev/e2e`)
- Screenshots on failure under `packages/e2e/test-results/`

## Docker Compose (optional)

Mock mode is the default. To run against Compose instead:

1. `docker compose up` (Mongo + backend + frontend)
2. Start mocks: `npm run test:e2e:mocks`
3. Point adapters at mock base URLs when those env knobs are available
4. `E2E_BASE_URL=http://localhost:3001 npm run test:e2e:ui`

## Layout

```
packages/e2e/
  fixtures/          committed mock payloads
  mocks/             Express servers (GitHub, Jira, LLM)
  helpers/           API harness + Playwright stubs
  tests/api/         vitest + supertest flows
  tests/ui/          Playwright smoke specs
  playwright.config.ts
  vitest.config.ts
```
