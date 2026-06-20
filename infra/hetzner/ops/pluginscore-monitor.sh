#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${PLUGINSCORE_ROOT_DIR:-/opt/pluginscore}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/hetzner/docker-compose.example.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/hetzner/.env}"
API_STATS_URL="${PLUGINSCORE_API_STATS_URL:-http://127.0.0.1:4010/stats}"

DISK_PATH="${PLUGINSCORE_ALERT_DISK_PATH:-/}"
DISK_PCT_LIMIT="${PLUGINSCORE_ALERT_DISK_PCT:-70}"
MEM_AVAILABLE_MB_LIMIT="${PLUGINSCORE_ALERT_MEMORY_AVAILABLE_MB:-1024}"
STALE_RUNNING_SECONDS="${PLUGINSCORE_ALERT_RUNNING_JOB_SECONDS:-1800}"
FAILED_JOB_LIMIT="${PLUGINSCORE_ALERT_FAILED_JOBS:-0}"
QUEUED_JOB_LIMIT="${PLUGINSCORE_ALERT_QUEUED_JOBS:-100}"
RESTART_LIMIT="${PLUGINSCORE_ALERT_CONTAINER_RESTARTS:-0}"
REPEAT_SECONDS="${PLUGINSCORE_ALERT_REPEAT_SECONDS:-3600}"

LOG_DIR="${PLUGINSCORE_ALERT_LOG_DIR:-/var/log/pluginscore}"
STATE_DIR="${PLUGINSCORE_ALERT_STATE_DIR:-/var/lib/pluginscore}"
ALERT_LOG="${PLUGINSCORE_ALERT_LOG:-$LOG_DIR/alerts.log}"
STATE_FILE="$STATE_DIR/monitor.last"
WEBHOOK_URL="${PLUGINSCORE_ALERT_WEBHOOK_URL:-}"

mkdir -p "$LOG_DIR" "$STATE_DIR"

alerts=()

add_alert() {
  alerts+=("$1")
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    add_alert "missing command: $command_name"
    return 1
  fi
}

require_command curl || true
require_command docker || true
require_command jq || true

if command -v df >/dev/null 2>&1; then
  disk_pct="$(df -P "$DISK_PATH" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  if [[ "$disk_pct" =~ ^[0-9]+$ ]] && (( disk_pct >= DISK_PCT_LIMIT )); then
    add_alert "disk usage on $DISK_PATH is ${disk_pct}% (limit ${DISK_PCT_LIMIT}%)"
  fi
else
  add_alert "missing command: df"
fi

if [[ -r /proc/meminfo ]]; then
  mem_available_mb="$(awk '/MemAvailable:/ { printf "%d", $2 / 1024 }' /proc/meminfo)"
  if [[ "$mem_available_mb" =~ ^[0-9]+$ ]] && (( mem_available_mb <= MEM_AVAILABLE_MB_LIMIT )); then
    add_alert "available memory is ${mem_available_mb} MB (limit ${MEM_AVAILABLE_MB_LIMIT} MB)"
  fi
else
  add_alert "unable to read /proc/meminfo"
fi

if command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  stats_json="$(curl -fsS --max-time 10 "$API_STATS_URL" 2>/dev/null || true)"
  if [[ -z "$stats_json" ]]; then
    add_alert "API stats endpoint did not respond: $API_STATS_URL"
  else
    failed_jobs="$(jq -r '.failedJobs // 0' <<<"$stats_json" 2>/dev/null || echo 0)"
    queued_jobs="$(jq -r '.queuedJobs // 0' <<<"$stats_json" 2>/dev/null || echo 0)"
    running_jobs="$(jq -r '.runningJobs // 0' <<<"$stats_json" 2>/dev/null || echo 0)"

    if [[ "$failed_jobs" =~ ^[0-9]+$ ]] && (( failed_jobs > FAILED_JOB_LIMIT )); then
      add_alert "failed scan jobs: $failed_jobs (limit $FAILED_JOB_LIMIT)"
    fi
    if [[ "$queued_jobs" =~ ^[0-9]+$ ]] && (( queued_jobs > QUEUED_JOB_LIMIT )); then
      add_alert "queued scan jobs: $queued_jobs (limit $QUEUED_JOB_LIMIT)"
    fi
    if [[ "$running_jobs" =~ ^[0-9]+$ ]] && (( running_jobs > 0 )); then
      echo "running scan jobs reported by API: $running_jobs"
    fi
  fi
fi

if [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] && command -v docker >/dev/null 2>&1; then
  compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

  stale_running_seconds="$("${compose[@]}" exec -T postgres psql -U pluginscore -d pluginscore -Atc \
    "select coalesce(max(extract(epoch from now() - updated_at))::int, 0) from scan_jobs where status = 'running';" \
    2>/dev/null || echo "query_failed")"
  if [[ "$stale_running_seconds" == "query_failed" ]]; then
    add_alert "unable to query Postgres for stale running jobs"
  elif [[ "$stale_running_seconds" =~ ^[0-9]+$ ]] && (( stale_running_seconds >= STALE_RUNNING_SECONDS )); then
    add_alert "oldest running scan job is ${stale_running_seconds}s old (limit ${STALE_RUNNING_SECONDS}s)"
  fi

  mapfile -t container_ids < <("${compose[@]}" ps -q 2>/dev/null || true)
  if (( ${#container_ids[@]} == 0 )); then
    add_alert "docker compose returned no PluginScore containers"
  fi

  for container_id in "${container_ids[@]}"; do
    [[ -z "$container_id" ]] && continue
    inspect_line="$(docker inspect -f '{{.Name}}|{{.State.Status}}|{{.RestartCount}}|{{.State.OOMKilled}}' "$container_id" 2>/dev/null || true)"
    if [[ -z "$inspect_line" ]]; then
      add_alert "unable to inspect container $container_id"
      continue
    fi

    IFS='|' read -r name status restart_count oom_killed <<<"$inspect_line"
    name="${name#/}"
    if [[ "$status" != "running" ]]; then
      add_alert "container $name status is $status"
    fi
    if [[ "$restart_count" =~ ^[0-9]+$ ]] && (( restart_count > RESTART_LIMIT )); then
      add_alert "container $name restart count is $restart_count (limit $RESTART_LIMIT)"
    fi
    if [[ "$oom_killed" == "true" ]]; then
      add_alert "container $name was OOM killed"
    fi
  done
else
  add_alert "missing compose file or env file for PluginScore stack"
fi

if (( ${#alerts[@]} == 0 )); then
  rm -f "$STATE_FILE"
  echo "PluginScore monitor ok"
  exit 0
fi

body="$(printf '%s\n' "${alerts[@]}")"
alert_hash="$(printf '%s' "$body" | sha256sum | awk '{ print $1 }')"
now_epoch="$(date +%s)"
last_hash=""
last_sent_at=0

if [[ -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE" || true
fi

should_send="yes"
if [[ "$alert_hash" == "$last_hash" ]] && (( now_epoch - last_sent_at < REPEAT_SECONDS )); then
  should_send="no"
fi

if [[ "$should_send" == "yes" ]]; then
  timestamp="$(date -Is)"
  {
    printf '[%s] PluginScore monitor alert on %s\n' "$timestamp" "$(hostname)"
    printf '%s\n\n' "$body"
  } | tee -a "$ALERT_LOG" >&2

  logger -t pluginscore-monitor -p daemon.warning -- "PluginScore monitor alert: $(tr '\n' '; ' <<<"$body")"

  if [[ -n "$WEBHOOK_URL" ]] && command -v jq >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    payload="$(jq -n --arg text "PluginScore monitor alert on $(hostname):"$'\n'"$body" '{text: $text}')"
    curl -fsS --max-time 10 -H 'Content-Type: application/json' -d "$payload" "$WEBHOOK_URL" >/dev/null \
      || logger -t pluginscore-monitor -p daemon.warning -- "PluginScore alert webhook delivery failed"
  fi

  {
    printf 'last_hash=%q\n' "$alert_hash"
    printf 'last_sent_at=%q\n' "$now_epoch"
  } > "$STATE_FILE"
else
  echo "PluginScore monitor alert still active; repeated notification suppressed."
fi

exit 2
