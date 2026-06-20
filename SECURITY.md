# Security

PluginScore processes third-party WordPress plugin ZIP files. Treat scanner and
backend changes as security-sensitive.

## Reporting

When the repository is public, use GitHub private vulnerability reporting if it
is enabled for the repo. If it is not enabled yet, contact the maintainer
privately before opening a public issue.

Do not publish exploit details, credentials, tokens, or private infrastructure
information in GitHub issues, pull requests, or discussions.

## Secret Handling

Never commit:

- `.env` or `.env.*` files
- Vercel project state from `.vercel`
- Hetzner credentials, rescue passwords, or root passwords
- `API_INTERNAL_TOKEN`
- database URLs or passwords
- `PLUGINSCORE_ADMIN_PASSWORD`
- scanner WordPress runtime passwords

Use `.env.example` and `infra/hetzner/backend.env.example` for placeholders only.

## Scanner Isolation

Scanner workers must run on a dedicated PluginScore backend host. Do not run
scanner jobs on the existing `aipower.org` or `docs.aipower.org` host, and do
not reuse production WordPress databases or files for scan runtime state.
