# AutoDev Monorepo

AI-powered SDLC automation platform — npm workspaces monorepo.

## Structure

```
packages/
├── backend/           # Express API (port 3002)
├── frontend/          # React + Vite (port 3001)
├── infrastructure/    # Shared runtime primitives (@autodev/infrastructure)
├── shared-types/      # Shared Zod schemas and TypeScript types
└── e2e/               # API / UI end-to-end tests
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for backend layer boundaries and allowed import directions.

## Prerequisites

- Node.js 22+
- Docker with Compose V5 (`docker compose` plugin; not the legacy `docker-compose` binary)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Run backend + frontend locally
npm run dev

# Or run full stack with MongoDB (Compose V5 file format — no version: field)
docker compose up --build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:backend` | Backend only (port 3002) |
| `npm run dev:frontend` | Frontend only (port 3001) |
| `npm test` | Run all package tests |
| `npm run lint` | Lint all packages |
| `npm run lint:boundaries` | Enforce backend architectural layer imports |
| `npm run build` | Build all packages |

## Health Check

```bash
curl http://localhost:3002/api/v1/health
```

## Environment

See `.env.example` for all required variables. Copy to `.env.local` for local overrides (git-ignored).
