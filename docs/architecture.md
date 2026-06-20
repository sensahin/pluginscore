# Architecture

## Production Split

```text
Vercel
  pluginscore.com
  Next.js App Router
  ISR pages and SEO routes
        |
        | HTTPS
        v
Hetzner PluginScore backend
  API service
  Postgres
  metadata/version scheduler
  Dockerized scanner workers
        |
        v
WordPress.org Plugin API and plugin ZIP downloads
```

## Safety Boundary

Do not deploy scanner workers, database migrations, cron jobs, Docker services, or API services onto the existing `aipower.org` / `docs.aipower.org` host without an explicit approval message. That server is production marketing infrastructure and should not unpack or process untrusted plugin ZIPs.

## Worker Contract

Each scan job should persist:

- plugin slug, version, download URL, source checksum, and WordPress.org metadata
- plugin icon, banner, description, author, compatibility, rating, and support counts
- Plugin Check version and scoring model version
- raw JSON output in `audit_runs.raw_report_json`
- stderr output
- duration, exit code, timeout flag, and retry count
- normalized finding code counts
- score snapshot and subscore snapshot

The MVP should run static checks only. Runtime checks can become a later isolated tier.

## Implemented Services

- `services/api`: Fastify API with Postgres and in-memory development stores.
- `services/scanner`: WordPress.org seeder plus single-job worker. The worker safely downloads official ZIPs, rejects unsafe archive paths, extracts to a temporary directory, runs `PLUGIN_CHECK_COMMAND`, normalizes JSON findings, and reports completion/failure to the API.
- `services/scheduler`: WordPress.org metadata/version watcher that queues scans only when a plugin version, Plugin Check version, or scoring model version needs an audit.
- `packages/core`: shared DTOs and sample data.
- `packages/scoring`: scoring weights, finding-family inference, and repeated-code penalty calculation.
- `packages/wporg`: shared WordPress.org Plugin API parser for metadata and download URLs.

## Reaudit Triggers

- plugin version changes
- Plugin Check version changes
- scoring model version changes
- manual retry after timeout or parser failure

## Public Pages

- `/plugins/[slug]`
- `/issues/[code]`
- `/categories/[category]`
- `/rankings`
- `/methodology`

Plugin profile pages use the latest audit run, stored score snapshot, and
deduped finding-code counts. They should not invent placeholder findings once a
real audit exists.
