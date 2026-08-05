#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${PLUGINSCORE_PRUNE_LOG_DIR:-/var/log/pluginscore}"
LOG_FILE="${PLUGINSCORE_PRUNE_LOG:-$LOG_DIR/docker-prune.log}"
LOCK_FILE="${PLUGINSCORE_PRUNE_LOCK:-/run/pluginscore-docker-prune.lock}"
BUILDER_PRUNE_FILTER="${PLUGINSCORE_BUILDER_PRUNE_FILTER:-until=168h}"

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  printf '[%s] Docker build-cache prune already running; skipping.\n' "$(date -Is)" | tee -a "$LOG_FILE"
  exit 0
fi

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
