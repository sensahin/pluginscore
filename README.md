# PluginScore

PluginScore is a Vercel-hosted Next.js interface plus a Hetzner-hosted scanner/API/database stack for automated WordPress Plugin Check audit results.

## Target Shape

- `apps/web`: Next.js App Router UI for plugin profiles, rankings, issue pages, and methodology.
- `services/api`: HTTP API and Postgres schema for plugin metadata, audit runs, finding codes, and score snapshots.
- `services/scanner`: Worker contract for downloading clean WordPress.org ZIPs and running Plugin Check.
- `services/scheduler`: WordPress.org version and metadata watcher that queues missing audits.
- `packages/scoring`: Shared score weighting and penalty logic.
- `packages/wporg`: Shared WordPress.org Plugin API metadata parser.
- `infra/hetzner`: Deployment notes for the future dedicated backend server.

The existing `aipower.org` and `docs.aipower.org` server must not be used for production scanning. It can remain untouched while this repo is developed locally and deployed later to a dedicated PluginScore backend host.

## Local Web

```bash
npm install
npm run dev:web
```

The public homepage is search-first and only shows user-facing plugin lookup,
recent scan, ranking, issue, and footer information surfaces. Operational
details such as queue state, backend health, and audit overview metrics live
under `/admin`.
The public search box records anonymous known-plugin search events through the
backend so the homepage can show real recent-search cards. The event table stores
the plugin relationship, normalized query slug, and timestamp only.

`/admin` is intentionally unlinked from the public UI. Set
`PLUGINSCORE_ADMIN_PASSWORD` and optionally `PLUGINSCORE_ADMIN_USERNAME` in the
web deployment environment to enable Basic auth. If the password is not set, the
route returns 404.

This project is intended to be open source. Keep `.env`, `.env.*`, `.vercel`,
backend tokens, database URLs, and admin passwords out of Git.
Set `NEXT_PUBLIC_GITHUB_URL` in Vercel once the public GitHub repository URL is
final.
Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel to enable Google Analytics on the
public web app without hard-coding a tracking property into forks.

## Local API

The API uses Postgres when `DATABASE_URL` is set. Without it, it serves the
shared sample data from an in-memory store.

```bash
npm run dev:api
curl http://127.0.0.1:4010/health
```

Queue and worker endpoints are internal-only when `API_INTERNAL_TOKEN` is set.
Use the same value for `services/api`, `services/scanner`, and the future
scheduler. Do not expose it to the Vercel web app.

## Verification

```bash
npm run ci
npm run prod:status
```

GitHub Actions runs the same CI command on Node 22 and Node 24 for pushes to
`main` and pull requests.

`npm run prod:status` is a read-only production check. It should report HTTP 200
for `https://api.pluginscore.com/health` before the top-1000 scanner backfill is
started or trusted.

When a dedicated backend host is ready, point the API subdomain at it with:

```bash
PLUGINSCORE_BACKEND_IPV4=203.0.113.10 npm run prod:dns
```

## Open Source Checklist

- Pick and add a license before the first public release.
- Keep real `.env` files, `.vercel`, Hetzner credentials, database URLs, and
  bearer tokens out of Git.
- Enable GitHub private vulnerability reporting after the repository is public.
- Set `NEXT_PUBLIC_GITHUB_URL` in Vercel once the final GitHub repository URL is
  known.

## Scheduler

The scheduler fetches WordPress.org popular plugins, refreshes metadata, and
queues scans only when the requested audit key is missing:

```bash
API_INTERNAL_TOKEN=change-me-long-random-token \
PLUGIN_CHECK_VERSION=2.0.0 \
npm run scheduler:once
```

The audit key is plugin version + Plugin Check version + scoring model version.
That keeps routine metadata refreshes cheap while still re-auditing after plugin
releases, Plugin Check upgrades, or scoring model changes.

## Scanner Smoke Flow

The production scanner image includes a private WordPress runtime plus WP-CLI and
Plugin Check. It uses `PLUGIN_CHECK_COMMAND=/usr/local/bin/run-plugin-check
{pluginDir} {jsonPath}` and a scanner-only MariaDB database. Do not point the
`WP_*` settings at the existing `aipower.org` or `docs.aipower.org` server.

Queue a plugin:

```bash
curl -X POST http://127.0.0.1:4010/jobs \
  -H "authorization: Bearer $API_INTERNAL_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"slug":"akismet","name":"Akismet Anti-spam","version":"5.4","downloadLink":"https://downloads.wordpress.org/plugin/akismet.latest-stable.zip","reason":"manual"}'
```

Run one real Plugin Check worker pass inside the scanner image, or on a host
where the runtime scripts have been installed to `/usr/local/bin`:

```bash
PLUGIN_CHECK_COMMAND='/usr/local/bin/run-plugin-check {pluginDir} {jsonPath}' \
PLUGIN_CHECK_VERSION=2.0.0 \
npm run scanner:once
```

For a no-audit smoke test that only proves queue/download/extract/report wiring:

```bash
PLUGIN_CHECK_COMMAND='printf "[]"' npm run scan:once -w services/scanner
```

## Hetzner Compose Preview

The example compose file is for a new dedicated PluginScore backend host:

```bash
ssh root@203.0.113.10 'CONFIRM_DEDICATED_PLUGINSCORE_HOST=yes bash -s' \
  < infra/hetzner/bootstrap-ubuntu.sh

cd /opt/pluginscore/infra/hetzner
cp backend.env.example .env
./deploy.sh
```

The scanner service is intentionally separate from the public API database. It
keeps WordPress bootstrap state in `scanner-db` and stores normalized scan output
through the API. The production container runs `work`, which polls for one job at
a time and sleeps for `SCAN_IDLE_SECONDS` when the queue is empty.
The scheduler runs separately and sleeps for `SCHEDULER_INTERVAL_SECONDS` between
WordPress.org metadata/version sync passes.

## Database Migration

```bash
DATABASE_URL=postgres://pluginscore:REPLACE_ME@db-host:5432/pluginscore \
npm run db:migrate -w services/api
```

## MVP Sequence

1. Calibrate the score with a top-100 seed.
2. Store raw Plugin Check JSON, stderr, runtime, exit status, and score snapshots.
3. Publish plugin, issue, category, and ranking pages from stable normalized data.
4. Backfill top 1000 after scoring and worker timeouts feel fair.
