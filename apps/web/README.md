# PluginScore Web

Next.js App Router UI for `pluginscore.com`.

## Routes

- `/`: search-first public homepage.
- `/search`: noindex query results page.
- `/plugins/[slug]`: plugin profile with metadata, score, latest audit, and finding counts.
- `/rankings`: score and metadata ranking views.
- `/issues/[code]`: issue pages for normalized Plugin Check finding codes.
- `/methodology`: scoring methodology.
- `/about`: project overview.
- `/admin`: private operations view. Returns 404 unless `PLUGINSCORE_ADMIN_PASSWORD` is set.

## Data

The app reads from `PLUGINSCORE_API_URL` when configured. Without it, pages use
shared sample data from `@pluginscore/core`, which keeps Vercel preview and local
development usable before the Hetzner backend exists.

The public search form records anonymous known-plugin searches through
`/api/searches`. That route no-ops when no backend URL is configured.

## Commands

Run from the repository root:

```bash
npm run dev:web
npm run lint
npm run build
```

Do not expose backend worker tokens, database URLs, or admin passwords to this
workspace.
