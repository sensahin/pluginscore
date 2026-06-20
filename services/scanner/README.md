# Scanner Worker

The scanner worker runs on the dedicated Hetzner PluginScore backend host.

MVP job flow:

1. Read one queued job from Postgres.
2. Download the official WordPress.org plugin ZIP into a clean temporary directory.
3. Record the ZIP SHA-256 checksum.
4. Extract the ZIP with path traversal checks.
5. Run a pinned WordPress Plugin Check version in Docker with CPU, memory, and wall-clock limits.
6. Capture strict JSON output, raw report JSON, stderr, duration, and exit status.
7. Normalize finding codes and store score snapshots.
8. Delete the temporary extraction directory.

Runtime:

- `node services/scanner/dist/index.js work` is the production command. It runs
  one scan at a time and sleeps for `SCAN_IDLE_SECONDS` when the queue is empty.
- `API_INTERNAL_TOKEN` must match the API service token when the backend protects
  queue and worker endpoints.
- `/usr/local/bin/ensure-wp-runtime` creates the scanner-only WordPress install,
  configures `wp-config.php`, waits for MariaDB, installs WordPress, and activates
  Plugin Check.
- `/usr/local/bin/run-plugin-check {pluginDir} {jsonPath}` runs `wp plugin check`
  with `--format=strict-json` and writes the report to the scanner JSON path.
- `PLUGIN_CHECK_MODE`, `PLUGIN_CHECK_CATEGORIES`, `PLUGIN_CHECK_CHECKS`,
  `PLUGIN_CHECK_EXCLUDE_CHECKS`, and `PLUGIN_CHECK_IGNORE_CODES` can narrow or
  adjust the audit without changing scanner code.

Guardrails:

- one worker at a time for the first top-100 calibration
- static checks only
- hard timeout per plugin
- no scan artifacts written into `aipower.org` or `docs.aipower.org` directories
- failed and timed-out scans remain visible in the product instead of disappearing
