#!/usr/bin/env bash
set -euo pipefail

WP_PATH="${WP_PATH:-/opt/wordpress}"
WP_URL="${WP_URL:-http://pluginscore.local}"
WP_TITLE="${WP_TITLE:-PluginScore Scanner}"
WP_ADMIN_USER="${WP_ADMIN_USER:-pluginscore}"
WP_ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:-pluginscore-local-admin}"
WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-scanner@pluginscore.local}"
WP_DB_HOST="${WP_DB_HOST:-scanner-db:3306}"
WP_DB_NAME="${WP_DB_NAME:-pluginscore_wp}"
WP_DB_USER="${WP_DB_USER:-wordpress}"
WP_DB_PASSWORD="${WP_DB_PASSWORD:-wordpress}"
WP_DB_CHARSET="${WP_DB_CHARSET:-utf8mb4}"
PLUGIN_CHECK_VERSION="${PLUGIN_CHECK_VERSION:-latest}"

DB_HOST_ONLY="${WP_DB_HOST%%:*}"
DB_PORT="${WP_DB_HOST##*:}"
DB_PORT_ARGS=()
if [[ "${DB_HOST_ONLY}" != "${DB_PORT}" ]]; then
  DB_PORT_ARGS=(-P "${DB_PORT}")
fi

mkdir -p "${WP_PATH}"

if [[ ! -f "${WP_PATH}/wp-load.php" ]]; then
  wp core download --path="${WP_PATH}" --allow-root
fi

until MYSQL_PWD="${WP_DB_PASSWORD}" mysqladmin ping \
  -h "${DB_HOST_ONLY}" \
  "${DB_PORT_ARGS[@]}" \
  -u "${WP_DB_USER}" \
  --silent; do
  sleep 2
done

if [[ ! -f "${WP_PATH}/wp-config.php" ]]; then
  wp config create \
    --path="${WP_PATH}" \
    --dbname="${WP_DB_NAME}" \
    --dbuser="${WP_DB_USER}" \
    --dbpass="${WP_DB_PASSWORD}" \
    --dbhost="${WP_DB_HOST}" \
    --dbcharset="${WP_DB_CHARSET}" \
    --skip-check \
    --allow-root
fi

wp db create --path="${WP_PATH}" --allow-root >/dev/null 2>&1 || true

if ! wp core is-installed --path="${WP_PATH}" --allow-root >/dev/null 2>&1; then
  wp core install \
    --path="${WP_PATH}" \
    --url="${WP_URL}" \
    --title="${WP_TITLE}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email \
    --allow-root
fi

if ! wp plugin is-installed plugin-check --path="${WP_PATH}" --allow-root >/dev/null 2>&1; then
  if [[ "${PLUGIN_CHECK_VERSION}" == "latest" ]]; then
    wp plugin install plugin-check --path="${WP_PATH}" --force --allow-root
  else
    wp plugin install plugin-check --path="${WP_PATH}" --version="${PLUGIN_CHECK_VERSION}" --force --allow-root
  fi
fi

wp plugin activate plugin-check --path="${WP_PATH}" --allow-root >/dev/null
