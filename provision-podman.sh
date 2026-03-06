#!/usr/bin/env bash
# provision-podman.sh — Non-interactive per-license gateway provisioning via Podman.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RUNTIME_CMD="podman"

exec bash "$ROOT_DIR/provision-docker.sh" "$@"
