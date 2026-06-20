# Hetzner Backend Notes

Do not deploy this stack to the existing `aipower.org` / `docs.aipower.org` production host unless the user explicitly approves that risk.

Recommended first production backend:

- 4 vCPU
- 8 GB RAM
- 120-160 GB disk
- Ubuntu LTS
- Docker and Docker Compose
- Postgres volume on local disk with backups enabled
- MariaDB volume for the scanner-only WordPress runtime
- Hetzner backups enabled
- Delete/rebuild protection enabled after the first successful deploy

Services:

- `caddy`: public HTTPS reverse proxy for `api.pluginscore.com`
- `api`: public read API and private worker/job API
- `postgres`: PluginScore metadata and audit summaries
- `scanner-db`: private WordPress bootstrap database for Plugin Check workers
- `scanner`: isolated worker with WP-CLI, Plugin Check, CPU/memory limits, and timeouts
- `scheduler`: WordPress.org metadata/version watcher and queue producer

Set `API_INTERNAL_TOKEN` to the same long random value for `api`, `scanner`,
and `scheduler`. Public read routes stay unauthenticated for the
Vercel UI, but queue and worker routes require that bearer token.

The scanner WordPress runtime is disposable application state for audits. It must
not reuse the `aipower.org` or `docs.aipower.org` WordPress files or database.

DNS target:

- `pluginscore.com` -> Vercel
- `api.pluginscore.com` -> Hetzner backend

## Safe First Deploy

Bootstrap a fresh Ubuntu LTS host from your workstation:

```bash
ssh root@203.0.113.10 'CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes bash -s' \
  < infra/hetzner/bootstrap-ubuntu.sh
```

Point the API subdomain at the dedicated backend. This script refuses the known
`aipower.org` IP:

```bash
PLUGINSCORE_BACKEND_IPV4=203.0.113.10 npm run prod:dns
```

Then, on the new dedicated PluginScore backend host only:

```bash
cd /opt/pluginscore/infra/hetzner
cp backend.env.example .env
# Fill .env with real random secrets and keep CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes.
./deploy.sh
```

The script builds the API, scanner, and scheduler images; starts Postgres,
scanner MariaDB, API, and Caddy; runs the database migration; then starts the
scheduler and one scanner worker. It refuses to run unless
`CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes` is present in `.env`.

After deploy, verify:

```bash
npm run prod:status
```

## Ops Hardening

On the dedicated PluginScore backend host, install the small safety net after
the first successful deploy:

```bash
cd /opt/pluginscore/infra/hetzner
./ops/install-ops-hardening.sh
```

This does three things:

- creates a 4 GB `/swapfile` with low swappiness
- enables `pluginscore-monitor.timer` every 5 minutes
- enables `pluginscore-docker-prune.timer` weekly

The monitor checks disk usage, available memory, stale running scan jobs,
failed/queued jobs, container restart counts, and OOM-killed containers. Alerts
go to the system journal and `/var/log/pluginscore/alerts.log`. To send the same
alert to a webhook, copy `ops/monitor.env.example` to `ops/monitor.env` on the
server and set `PLUGINSCORE_ALERT_WEBHOOK_URL`.

The Docker prune timer removes old build cache only; it does not remove running
containers, named volumes, or application data. Run it manually with
`PLUGINSCORE_BUILDER_PRUNE_FILTER=none ./ops/pluginscore-docker-prune.sh` if the
build cache needs to be reclaimed immediately.

## Start The Top-1000 Backfill

On the dedicated PluginScore backend host, after `infra/hetzner/.env` is set:

```bash
./infra/hetzner/start-top1000.sh
```

This seeds the current WordPress.org popular top 1000 into the scan queue and
starts one scanner worker. Keep concurrency at one worker until timeouts and
score weights are calibrated.

After `https://api.pluginscore.com/health` returns ok, set this only in Vercel:

```bash
vercel env add PLUGINSCORE_API_URL production
# value: https://api.pluginscore.com
vercel --prod
```

Keep `API_INTERNAL_TOKEN`, Postgres passwords, WordPress scanner passwords, and
admin passwords out of GitHub and out of the Vercel public frontend bundle.
