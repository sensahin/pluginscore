#!/usr/bin/env bash
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HETZNER_DIR="$(cd "$OPS_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HETZNER_DIR/.env}"
SWAP_FILE="${PLUGINSCORE_SWAP_FILE:-/swapfile}"
SWAP_SIZE="${PLUGINSCORE_SWAP_SIZE:-4G}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the dedicated PluginScore backend host." >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ "${CONFIRM_DEDICATED_PLUGINSCORE_HOST:-}" != "yes" ]]; then
  echo "Refusing to install ops hardening without CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes." >&2
  echo "Use only the dedicated PluginScore backend host, not aipower.org or docs.aipower.org." >&2
  exit 1
fi

if grep -R -qE '(^|[^[:alnum:].-])(docs\.)?aipower\.org([^[:alnum:].-]|$)' /etc/nginx /etc/caddy 2>/dev/null; then
  echo "Refusing to install ops hardening: this host appears to contain aipower.org/docs.aipower.org config." >&2
  exit 1
fi

if ! swapon --show=NAME --noheadings | grep -qx "$SWAP_FILE"; then
  if [[ ! -f "$SWAP_FILE" ]]; then
    fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
  fi
  chmod 600 "$SWAP_FILE"
  if ! file "$SWAP_FILE" | grep -q "swap file"; then
    mkswap "$SWAP_FILE" >/dev/null
  fi
  swapon "$SWAP_FILE"
fi

if ! awk -v swap_file="$SWAP_FILE" '$1 == swap_file && $2 == "none" && $3 == "swap" { found = 1 } END { exit(found ? 0 : 1) }' /etc/fstab; then
  printf '%s none swap sw 0 0\n' "$SWAP_FILE" >> /etc/fstab
fi

cat >/etc/sysctl.d/99-pluginscore-swap.conf <<'SYSCTL'
vm.swappiness=10
vm.vfs_cache_pressure=50
SYSCTL
sysctl --system >/dev/null

install -d -m 0755 /var/log/pluginscore /var/lib/pluginscore
chmod 0755 "$OPS_DIR/pluginscore-monitor.sh" "$OPS_DIR/pluginscore-docker-prune.sh"
install -m 0644 "$OPS_DIR/systemd/pluginscore-monitor.service" /etc/systemd/system/pluginscore-monitor.service
install -m 0644 "$OPS_DIR/systemd/pluginscore-monitor.timer" /etc/systemd/system/pluginscore-monitor.timer
install -m 0644 "$OPS_DIR/systemd/pluginscore-docker-prune.service" /etc/systemd/system/pluginscore-docker-prune.service
install -m 0644 "$OPS_DIR/systemd/pluginscore-docker-prune.timer" /etc/systemd/system/pluginscore-docker-prune.timer

systemctl daemon-reload
systemctl enable --now pluginscore-monitor.timer pluginscore-docker-prune.timer
systemctl start pluginscore-monitor.service || true

echo "PluginScore ops hardening installed."
swapon --show
systemctl list-timers --all --no-pager | grep -E 'pluginscore-(monitor|docker-prune)' || true
