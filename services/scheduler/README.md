# Scheduler

The scheduler keeps PluginScore's WordPress.org source metadata and scan queue fresh.

Commands:

- `sync-once`: fetch the current popular plugin window and enqueue missing audits.
- `work`: repeat `sync-once`, then sleep for `SCHEDULER_INTERVAL_SECONDS`.

Each enqueue request includes:

- current WordPress.org plugin metadata, including icon, banner, description,
  author, compatibility, rating, and support counts
- `PLUGIN_CHECK_VERSION`
- `SCORING_MODEL_VERSION`

The API skips enqueueing when a completed audit already exists for the same
plugin version, Plugin Check version, and scoring model version. A new plugin
release, Plugin Check upgrade, or scoring model change creates fresh work.
