#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/hetzner/docker-compose.example.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/hetzner/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy backend.env.example to .env on the dedicated PluginScore backend host first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${CONFIRM_DEDICATED_PLUGINSCORE_HOST:-}" != "yes" ]]; then
  echo "Refusing to run without CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes." >&2
  exit 1
fi

cd "$ROOT_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres scanner-db api caddy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build scheduler scanner

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm \
  -e SCHEDULER_LIMIT="${SCHEDULER_LIMIT:-1000}" \
  -e SCHEDULER_PRIORITY="${SCHEDULER_PRIORITY:-100}" \
  scheduler \
  node services/scheduler/dist/index.js sync-once

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --scale scanner=1 scanner

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
echo
echo "Top-${SCHEDULER_LIMIT:-1000} queue seeded. One scanner worker is running."
echo "Watch progress with:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f scanner"
