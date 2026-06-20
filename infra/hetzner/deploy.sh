#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.example.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing %s. Copy backend.env.example to %s and fill in real secrets.\n' "$ENV_FILE" "$ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${CONFIRM_DEDICATED_PLUGINSCORE_HOST:-}" != "yes" ]]; then
  printf 'Refusing to deploy: CONFIRM_DEDICATED_PLUGINSCORE_HOST must be yes in %s.\n' "$ENV_FILE" >&2
  printf 'Use only a dedicated PluginScore backend host, not aipower.org or docs.aipower.org.\n' >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build api scanner scheduler
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres scanner-db api caddy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile tools run --rm migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d scheduler scanner
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
