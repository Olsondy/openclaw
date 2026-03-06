#!/usr/bin/env bash
# Backward-compatible wrapper.
# New canonical script name: provision-docker.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "[deprecated] provision-instance.sh -> provision-docker.sh" >&2

exec bash "$ROOT_DIR/provision-docker.sh" "$@"
