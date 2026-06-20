#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM_DEDICATED_PLUGINSCORE_HOST:-}" != "yes" ]]; then
  echo "Refusing to bootstrap without CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes." >&2
  echo "Run this only on the dedicated PluginScore backend host." >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on a fresh Ubuntu LTS backend host." >&2
  exit 1
fi

if grep -R -qE '(^|[^[:alnum:].-])(docs\.)?aipower\.org([^[:alnum:].-]|$)' /etc/nginx /etc/caddy 2>/dev/null; then
  echo "Refusing to bootstrap: this host appears to contain aipower.org/docs.aipower.org config." >&2
  exit 1
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
fi

if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "This bootstrap script expects Ubuntu LTS. Detected ID=${ID:-unknown}." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git gnupg jq rsync ufw

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

docker_codename="${VERSION_CODENAME:-}"
if [[ -z "$docker_codename" ]]; then
  echo "Unable to detect Ubuntu codename for Docker apt repository." >&2
  exit 1
fi

cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $docker_codename stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp

echo "Bootstrap complete. Docker is ready; firewall rules for SSH, HTTP, and HTTPS are present."
echo "Clone the repo into /opt/pluginscore, create infra/hetzner/.env, then run infra/hetzner/deploy.sh."
