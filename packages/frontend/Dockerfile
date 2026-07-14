# syntax=docker/dockerfile:1
# Build from monorepo root:
#   docker build -f packages/frontend/Dockerfile .

ARG NODE_IMAGE=node:22.23-alpine3.18

FROM ${NODE_IMAGE} AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:3002

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/frontend/package.json packages/frontend/

RUN npm ci -w @autodev/shared-types -w @autodev/frontend --include-workspace-root=false

COPY packages/shared-types packages/shared-types
COPY packages/frontend packages/frontend

ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build -w @autodev/shared-types \
  && npm run build -w @autodev/frontend

FROM ${NODE_IMAGE} AS production
WORKDIR /app
ENV NODE_ENV=production

RUN npm install --omit=dev -g serve@14.2.4 \
  && npm cache clean --force \
  && mkdir -p /app/dist \
  && chown -R node:node /app

COPY --from=build --chown=node:node /app/packages/frontend/dist /app/dist

USER node
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["serve", "-s", "dist", "-l", "3001"]
