#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-pluginscore.com}"
API_RECORD="${API_RECORD:-api}"
BACKEND_IPV4="${PLUGINSCORE_BACKEND_IPV4:-${1:-}}"
AIPOWER_IPV4="${AIPOWER_IPV4:-}"

if [[ -z "$BACKEND_IPV4" ]]; then
  echo "Usage: PLUGINSCORE_BACKEND_IPV4=203.0.113.10 $0" >&2
  echo "This must be the dedicated PluginScore backend IP." >&2
  exit 1
fi

if [[ ! "$BACKEND_IPV4" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "Invalid IPv4 address: $BACKEND_IPV4" >&2
  exit 1
fi

if [[ -n "$AIPOWER_IPV4" && "$BACKEND_IPV4" == "$AIPOWER_IPV4" ]]; then
  echo "Refusing to point api.pluginscore.com at the configured aipower.org host." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is required to update DNS." >&2
  exit 1
fi

fqdn="$API_RECORD.$DOMAIN"
current="$(dig +short "$fqdn" A 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]*$//')"

echo "Current $fqdn A records: ${current:-none}"
if printf '%s\n' "$current" | tr ' ' '\n' | grep -Fxq "$BACKEND_IPV4"; then
  echo "$fqdn already resolves to $BACKEND_IPV4."
  exit 0
fi

echo "Adding explicit Vercel DNS record: $fqdn A $BACKEND_IPV4"
vercel dns add "$DOMAIN" "$API_RECORD" A "$BACKEND_IPV4"

echo
echo "DNS record requested. Re-run npm run prod:status after propagation and backend deploy."
