# Scheduler

The scheduler keeps PluginScore's WordPress.org source metadata and scan queue fresh.

Commands:

- `sync-once`: fetch the current popular plugin list and enqueue one bounded window of missing audits.
- `work`: repeat `sync-once`, advance the in-memory cursor, then sleep for `SCHEDULER_INTERVAL_SECONDS`.

`SCHEDULER_LIMIT` controls the popular-list horizon. `SCHEDULER_BATCH_SIZE`
controls how many popular plugins are checked per pass, so a top-10000 watcher
can spread work over many hourly passes instead of stampeding the API/database.
`SCHEDULER_TRACKED_BATCH_SIZE` does the same for non-popular tracked plugins.
`SCHEDULER_ENQUEUE_DELAY_MS` adds a small pause after each bulk enqueue request.

Each enqueue request includes:

- current WordPress.org plugin metadata, including icon, banner, description,
  author, compatibility, rating, and support counts
- `PLUGIN_CHECK_VERSION`
- `SCORING_MODEL_VERSION`

The API skips enqueueing when a completed audit already exists for the same
plugin version, Plugin Check version, and scoring model version. A new plugin
release, Plugin Check upgrade, or scoring model change creates fresh work.
