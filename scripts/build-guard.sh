#!/usr/bin/env sh
# AutoDev build source-tree guard (WO-040). Invoked by npm run build.
set -e
cd "$(dirname "$0")/.."
npm run guard:build
