# Contributing

Thanks for helping improve PluginScore.

## Local Setup

```bash
npm install
npm run dev:web
```

The web app works with sample data when `PLUGINSCORE_API_URL` is unset. Use a
local API or the dedicated PluginScore backend only when you intentionally need
live data.

## Verification

Before opening a pull request, run:

```bash
npm run ci
```

That command runs package builds, TypeScript checks, web linting, and the full
production build.

## Safety Rules

- Do not commit `.env`, `.env.*`, `.vercel`, database URLs, bearer tokens, admin
  passwords, or Hetzner rescue credentials.
- Do not deploy scanner workers or backend services to the existing
  `aipower.org` or `docs.aipower.org` host.
- Keep scan workers isolated from marketing/production WordPress sites.
- Use official WordPress.org plugin ZIP downloads for scanner work.
- Keep public UI copy concise and user-facing. Operational queue/backend details
  belong under `/admin`.

## Pull Requests

Small, focused pull requests are easiest to review. Include the commands you ran
and call out any skipped verification.
