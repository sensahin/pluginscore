#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BASE_COMPOSE_FILE="${BASE_COMPOSE_FILE:-docker-compose.example.yml}"
OVERRIDE_COMPOSE_FILE="${OVERRIDE_COMPOSE_FILE:-docker-compose.nginx-host.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing %s. Copy backend.env.example to %s and fill in real secrets.\n' "$ENV_FILE" "$ENV_FILE" >&2
  exit 1
fi

docker compose \
  --env-file "$ENV_FILE" \
  -f "$BASE_COMPOSE_FILE" \
  -f "$OVERRIDE_COMPOSE_FILE" \
  build api scanner scheduler

docker compose \
  --env-file "$ENV_FILE" \
  -f "$BASE_COMPOSE_FILE" \
  -f "$OVERRIDE_COMPOSE_FILE" \
  up -d postgres scanner-db api

docker compose \
  --env-file "$ENV_FILE" \
  -f "$BASE_COMPOSE_FILE" \
  -f "$OVERRIDE_COMPOSE_FILE" \
  --profile tools run --rm migrate

docker compose \
  --env-file "$ENV_FILE" \
  -f "$BASE_COMPOSE_FILE" \
  -f "$OVERRIDE_COMPOSE_FILE" \
  up -d scheduler scanner

docker compose \
  --env-file "$ENV_FILE" \
  -f "$BASE_COMPOSE_FILE" \
  -f "$OVERRIDE_COMPOSE_FILE" \
  ps
