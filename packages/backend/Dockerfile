# syntax=docker/dockerfile:1
# Build from monorepo root:
#   docker build -f packages/backend/Dockerfile .

ARG NODE_IMAGE=node:22.23-alpine3.18

FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/infrastructure/package.json packages/infrastructure/
COPY packages/backend/package.json packages/backend/

RUN npm ci -w @autodev/shared-types -w @autodev/infrastructure -w @autodev/backend --include-workspace-root=false

COPY packages/shared-types packages/shared-types
COPY packages/infrastructure packages/infrastructure
COPY packages/backend packages/backend

RUN npm run build -w @autodev/shared-types \
  && npm pkg set main=./dist/index.js -w @autodev/shared-types \
  && npm pkg set types=./dist/index.d.ts -w @autodev/shared-types \
  && npm pkg set exports.=./dist/index.js -w @autodev/shared-types \
  && npm run build -w @autodev/infrastructure \
  && npm pkg set main=./dist/index.js -w @autodev/infrastructure \
  && npm pkg set types=./dist/index.d.ts -w @autodev/infrastructure \
  && npm pkg set exports.=./dist/index.js -w @autodev/infrastructure \
  && npm run build -w @autodev/backend \
  && find packages/backend/dist -name '*.test.js' -delete \
  && find packages/backend/dist -name '*.test.js.map' -delete

FROM ${NODE_IMAGE} AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/infrastructure/package.json packages/infrastructure/
COPY packages/backend/package.json packages/backend/

RUN npm ci -w @autodev/shared-types -w @autodev/infrastructure -w @autodev/backend --omit=dev --include-workspace-root=false \
  && npm cache clean --force

COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/infrastructure/dist packages/infrastructure/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist

RUN npm pkg set main=./dist/index.js -w @autodev/shared-types \
  && npm pkg set types=./dist/index.d.ts -w @autodev/shared-types \
  && npm pkg set exports.=./dist/index.js -w @autodev/shared-types \
  && npm pkg set main=./dist/index.js -w @autodev/infrastructure \
  && npm pkg set types=./dist/index.d.ts -w @autodev/infrastructure \
  && npm pkg set exports.=./dist/index.js -w @autodev/infrastructure \
  && chown -R node:node /app

USER node
WORKDIR /app/packages/backend
EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3002/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
