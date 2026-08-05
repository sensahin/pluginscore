#!/usr/bin/env bash
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the PluginScore backend host." >&2
  exit 1
fi

for command_name in docker flock systemctl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

install -d -m 0755 /var/log/pluginscore
chmod 0755 "$OPS_DIR/pluginscore-docker-prune.sh"
install -m 0644 "$OPS_DIR/systemd/pluginscore-docker-prune.service" /etc/systemd/system/pluginscore-docker-prune.service
install -m 0644 "$OPS_DIR/systemd/pluginscore-docker-prune.timer" /etc/systemd/system/pluginscore-docker-prune.timer

systemctl daemon-reload
systemctl enable --now pluginscore-docker-prune.timer

echo "PluginScore Docker build-cache cleanup timer installed."
systemctl list-timers --all --no-pager pluginscore-docker-prune.timer
