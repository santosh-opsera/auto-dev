# AutoDev Monorepo

AI-powered SDLC automation platform — npm workspaces monorepo.

## Structure

```
packages/
├── backend/        # Express API (port 3002)
├── frontend/       # React + Vite (port 3001)
└── shared-types/   # Shared Zod schemas and TypeScript types
```

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for full stack)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Run backend + frontend locally
npm run dev

# Or run full stack with MongoDB
docker-compose up
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:backend` | Backend only (port 3002) |
| `npm run dev:frontend` | Frontend only (port 3001) |
| `npm test` | Run all package tests |
| `npm run lint` | Lint all packages |
| `npm run build` | Build all packages |

## Health Check

```bash
curl http://localhost:3002/api/v1/health
```

## Environment

See `.env.example` for all required variables. Copy to `.env.local` for local overrides (git-ignored).
