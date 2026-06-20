#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${PLUGINSCORE_PRUNE_LOG_DIR:-/var/log/pluginscore}"
LOG_FILE="${PLUGINSCORE_PRUNE_LOG:-$LOG_DIR/docker-prune.log}"
BUILDER_PRUNE_FILTER="${PLUGINSCORE_BUILDER_PRUNE_FILTER:-until=168h}"

mkdir -p "$LOG_DIR"

args=(-af)
if [[ "$BUILDER_PRUNE_FILTER" != "none" ]]; then
  args+=(--filter "$BUILDER_PRUNE_FILTER")
fi

{
  printf '\n[%s] Docker build-cache prune starting on %s\n' "$(date -Is)" "$(hostname)"
  docker system df
  printf '\nRunning: docker builder prune %s\n' "${args[*]}"
  docker builder prune "${args[@]}"
  printf '\n[%s] Docker disk usage after prune\n' "$(date -Is)"
  docker system df
} >>"$LOG_FILE" 2>&1

tail -40 "$LOG_FILE"
