#!/usr/bin/env bash
# provision-docker.sh — Non-interactive per-license gateway provisioning.
# Supports Docker by default and can also run with Podman via RUNTIME_CMD=podman.
#
# Required env vars (injected by licenseProvisioningService):
#   COMPOSE_PROJECT_NAME      — unique per-license compose project
#   OPENCLAW_CONFIG_DIR       — host path for .openclaw config bind-mount
#   OPENCLAW_WORKSPACE_DIR    — host path for workspace bind-mount
#   OPENCLAW_GATEWAY_PORT     — host port for gateway (18789 inside container)
#   OPENCLAW_BRIDGE_PORT      — host port for bridge  (18790 inside container)
#   OPENCLAW_GATEWAY_TOKEN    — pre-generated 64-char hex token
#   OPENCLAW_GATEWAY_BIND     — bind mode (default: lan)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
IMAGE_NAME="${OPENCLAW_IMAGE:-openclaw:local}"
RUNTIME_CMD="${RUNTIME_CMD:-docker}"

if ! command -v "$RUNTIME_CMD" >/dev/null 2>&1; then
  echo "Missing runtime command: $RUNTIME_CMD" >&2
  exit 1
fi

# Validate required vars
: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is required}"
: "${OPENCLAW_CONFIG_DIR:?OPENCLAW_CONFIG_DIR is required}"
: "${OPENCLAW_WORKSPACE_DIR:?OPENCLAW_WORKSPACE_DIR is required}"
: "${OPENCLAW_GATEWAY_PORT:?OPENCLAW_GATEWAY_PORT is required}"
: "${OPENCLAW_BRIDGE_PORT:?OPENCLAW_BRIDGE_PORT is required}"
: "${OPENCLAW_GATEWAY_TOKEN:?OPENCLAW_GATEWAY_TOKEN is required}"
OPENCLAW_GATEWAY_BIND="${OPENCLAW_GATEWAY_BIND:-lan}"

echo "==> Provisioning instance: $COMPOSE_PROJECT_NAME (runtime=$RUNTIME_CMD)"
echo "    Config dir:  $OPENCLAW_CONFIG_DIR"
echo "    Gateway port: $OPENCLAW_GATEWAY_PORT  Bridge port: $OPENCLAW_BRIDGE_PORT"

# Create directory structure
mkdir -p "$OPENCLAW_CONFIG_DIR"
mkdir -p "$OPENCLAW_WORKSPACE_DIR"
mkdir -p "$OPENCLAW_CONFIG_DIR/identity"
mkdir -p "$OPENCLAW_CONFIG_DIR/agents/main/agent"
mkdir -p "$OPENCLAW_CONFIG_DIR/agents/main/sessions"

# Pre-seed openclaw.json (replaces interactive onboard)
CONFIG_FILE="$OPENCLAW_CONFIG_DIR/openclaw.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<JSON
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "$OPENCLAW_GATEWAY_BIND",
    "controlUi": {
      "dangerouslyAllowHostHeaderOriginFallback": true
    },
    "auth": {
      "mode": "token",
      "token": "$OPENCLAW_GATEWAY_TOKEN"
    },
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "remote": {
      "token": ""
    },
    "nodes": {
      "denyCommands": [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send"
      ]
    }
  },
  "tools": {
    "exec": {
      "host": "node",
      "security": "allowlist",
      "ask": "on-miss"
    },
    "profile": "messaging",
    "alsoAllow": ["group:fs", "gateway", "group:runtime"],
    "fs": { "workspaceOnly": true }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "zai": {
        "baseUrl": "https://open.bigmodel.cn/api/paas/v4/",
        "api": "openai-completions",
        "models": [
          {
            "id": "glm-4.7-flash",
            "name": "GLM-4.7 Flash (Free)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "zai/glm-4.7-flash"
      }
    }
  }
}
JSON
  echo "==> Pre-seeded $CONFIG_FILE"
else
  echo "==> Config already exists, skipping seed."
fi

# Build image only if not already present
if ! "$RUNTIME_CMD" image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "==> Building image: $IMAGE_NAME (first run only)"
  "$RUNTIME_CMD" build \
    -t "$IMAGE_NAME" \
    -f "$ROOT_DIR/Dockerfile" \
    "$ROOT_DIR"
else
  echo "==> Image $IMAGE_NAME exists, skipping build."
fi

# Fix bind-mount directory ownership (container runs as node uid=1000)
echo "==> Fixing data-directory permissions"
"$RUNTIME_CMD" run --rm --user root \
  -v "${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw" \
  "$IMAGE_NAME" \
  sh -c 'find /home/node/.openclaw -xdev -exec chown node:node {} +'

# 安装飞书插件（在 gateway 启动前，避免 depends_on 约束）
echo "==> Installing feishu plugin"
"$RUNTIME_CMD" run --rm \
  -v "${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw" \
  "$IMAGE_NAME" \
  node dist/index.js plugins install ./extensions/feishu

# Start gateway
echo "==> Starting gateway (project=$COMPOSE_PROJECT_NAME)"

export OPENCLAW_CONFIG_DIR
export OPENCLAW_WORKSPACE_DIR
export OPENCLAW_GATEWAY_PORT
export OPENCLAW_BRIDGE_PORT
export OPENCLAW_GATEWAY_BIND
export OPENCLAW_GATEWAY_TOKEN
export OPENCLAW_IMAGE="$IMAGE_NAME"
export OPENCLAW_ALLOW_INSECURE_PRIVATE_WS="${OPENCLAW_ALLOW_INSECURE_PRIVATE_WS:-}"

"$RUNTIME_CMD" compose \
  -p "$COMPOSE_PROJECT_NAME" \
  -f "$COMPOSE_FILE" \
  up -d openclaw-gateway

echo ""
echo "==> Gateway started successfully"
echo "    Project:  $COMPOSE_PROJECT_NAME"
echo "    Port:     $OPENCLAW_GATEWAY_PORT"
echo "    Token:    $OPENCLAW_GATEWAY_TOKEN"
