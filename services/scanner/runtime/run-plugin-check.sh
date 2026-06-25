#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="${1:?Plugin directory is required}"
JSON_PATH="${2:?JSON output path is required}"
WP_PATH="${WP_PATH:-/opt/wordpress}"
PLUGIN_CHECK_MODE="${PLUGIN_CHECK_MODE:-new}"

mkdir -p "$(dirname "${JSON_PATH}")"

/usr/local/bin/ensure-wp-runtime

ARGS=(
  --path="${WP_PATH}"
  plugin
  check
  "${PLUGIN_DIR}"
  --format=json
  --mode="${PLUGIN_CHECK_MODE}"
)

if [[ -n "${PLUGIN_CHECK_CATEGORIES:-}" ]]; then
  ARGS+=(--categories="${PLUGIN_CHECK_CATEGORIES}")
fi

if [[ -n "${PLUGIN_CHECK_CHECKS:-}" ]]; then
  ARGS+=(--checks="${PLUGIN_CHECK_CHECKS}")
fi

if [[ -n "${PLUGIN_CHECK_EXCLUDE_CHECKS:-}" ]]; then
  ARGS+=(--exclude-checks="${PLUGIN_CHECK_EXCLUDE_CHECKS}")
fi

if [[ -n "${PLUGIN_CHECK_IGNORE_CODES:-}" ]]; then
  ARGS+=(--ignore-codes="${PLUGIN_CHECK_IGNORE_CODES}")
fi

wp "${ARGS[@]}" > "${JSON_PATH}"
