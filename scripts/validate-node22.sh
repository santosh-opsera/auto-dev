#!/usr/bin/env bash
# Validate Node.js 22 runtime + native addon / crypto compatibility (WO-026 / REQ-013).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
NODE_FULL="$(node -v)"
echo "Host Node: ${NODE_FULL}"

if [[ "${NODE_MAJOR}" != "22" ]]; then
  echo "ERROR: Expected Node.js 22.x (found ${NODE_FULL}). Use \`nvm use\` / \`.nvmrc\`." >&2
  exit 1
fi

if [[ ! -f .nvmrc ]] || [[ "$(tr -d '[:space:]' < .nvmrc)" != "22" ]]; then
  echo "ERROR: .nvmrc must pin Node 22" >&2
  exit 1
fi

node -e "
const crypto = require('crypto');
if (typeof crypto.createCipheriv !== 'function') throw new Error('createCipheriv missing');
if (typeof crypto.createCipher === 'function') {
  console.warn('WARN: legacy createCipher still present (unexpected on Node 22+)');
}
console.log('crypto: createCipheriv OK; legacy createCipher=' + typeof crypto.createCipher);
"

echo "Rebuilding native addons..."
npm rebuild

echo "Running encryption + memory-mongo-backed backend tests..."
npm run test -w @autodev/backend -- --reporter=dot

IMAGE="node:22.23-alpine3.18"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_NODE="$(docker run --rm "${IMAGE}" node --version)"
  echo "Docker ${IMAGE} node: ${DOCKER_NODE}"
  case "${DOCKER_NODE}" in
    v22.*) ;;
    *)
      echo "ERROR: Docker image ${IMAGE} did not report v22.x (${DOCKER_NODE})" >&2
      exit 1
      ;;
  esac
else
  echo "WARN: Docker daemon unavailable; skipped ${IMAGE} node --version check (compose still pins NODE_IMAGE=${IMAGE})"
fi

echo "npm audit (production)..."
npm audit --omit=dev --audit-level=high

echo "Node 22 validation succeeded."
