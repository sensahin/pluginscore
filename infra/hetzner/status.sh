#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/hetzner/docker-compose.example.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/infra/hetzner/.env}"
API_DOMAIN="${API_DOMAIN:-api.pluginscore.com}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

API_DOMAIN="${API_DOMAIN:-api.pluginscore.com}"
API_BASE_URL="${API_BASE_URL:-https://$API_DOMAIN}"

echo "PluginScore production status"
echo
echo "DNS for $API_DOMAIN:"
resolved_ipv4s=""
if command -v dig >/dev/null 2>&1; then
  resolved_ipv4s="$(dig +short "$API_DOMAIN" A || true)"
  printf '%s\n' "$resolved_ipv4s"
else
  getent hosts "$API_DOMAIN" || true
fi

curl_resolve_args=()
first_ipv4="$(printf '%s\n' "$resolved_ipv4s" | sed -n '1p')"
if [[ "$API_BASE_URL" == "https://$API_DOMAIN"* && -n "$first_ipv4" ]]; then
  curl_resolve_args=(--resolve "$API_DOMAIN:443:$first_ipv4")
fi

echo
echo "API health:"
health_status="$(curl "${curl_resolve_args[@]}" -sS -m 10 -o /tmp/pluginscore-health.json -w "%{http_code}" "$API_BASE_URL/health" || true)"
echo "HTTP $health_status $API_BASE_URL/health"
if [[ -s /tmp/pluginscore-health.json ]]; then
  sed -n '1,6p' /tmp/pluginscore-health.json
fi

echo
echo "API stats:"
stats_status="$(curl "${curl_resolve_args[@]}" -sS -m 10 -o /tmp/pluginscore-stats.json -w "%{http_code}" "$API_BASE_URL/stats" || true)"
echo "HTTP $stats_status $API_BASE_URL/stats"
if [[ -s /tmp/pluginscore-stats.json ]]; then
  first_char="$(LC_ALL=C tr -d '[:space:]' < /tmp/pluginscore-stats.json | cut -c 1)"
  if [[ "$first_char" == "{" || "$first_char" == "[" ]] && command -v jq >/dev/null 2>&1; then
    jq '{indexedPlugins, completedScans, queuedJobs, runningJobs, failedJobs, issueCodes, recentSearches}' /tmp/pluginscore-stats.json 2>/dev/null || jq . /tmp/pluginscore-stats.json
  else
    sed -n '1,12p' /tmp/pluginscore-stats.json
  fi
fi

if [[ -f "$ENV_FILE" ]] && command -v docker >/dev/null 2>&1; then
  echo
  echo "Docker services:"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
fi

rm -f /tmp/pluginscore-health.json /tmp/pluginscore-stats.json

if [[ "$health_status" != "200" ]]; then
  echo
  echo "API health is not ready. Do not start or trust production scanning until this returns HTTP 200." >&2
  exit 1
fi
