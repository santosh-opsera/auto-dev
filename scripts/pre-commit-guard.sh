#!/usr/bin/env sh
# AutoDev pre-commit guard (WO-040). Invoked by husky; safe to call directly.
set -e
cd "$(dirname "$0")/.."
npm run precommit:guard
