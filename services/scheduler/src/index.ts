import { SCORING_MODEL_VERSION } from "@pluginscore/scoring";
import { fetchPluginBySlug, fetchPopularPlugins } from "@pluginscore/wporg";
import { PluginScoreApiClient } from "./api-client.js";
import { getConfig } from "./config.js";

const command = process.argv[2];
const config = getConfig();
const api = new PluginScoreApiClient(config.apiUrl, config.apiInternalToken);

if (command === "sync-once") {
  await syncOnce();
} else if (command === "work") {
  await work();
} else {
  console.error("Usage: tsx src/index.ts <sync-once|work>");
  process.exit(1);
}

async function work() {
  console.log(
    `Scheduler polling top ${config.limit} plugins every ${config.pollIntervalMs / 1000}s.`,
  );

  while (true) {
    try {
      await syncOnce();
    } catch (error) {
      console.error(`Scheduler pass failed: ${(error as Error).message}`);
    }

    await sleep(config.pollIntervalMs);
  }
}

async function syncOnce() {
  const plugins = await fetchPopularPlugins(config.limit);
  let queued = 0;
  let satisfied = 0;
  let failed = 0;
  const popularSlugs = new Set(plugins.map((plugin) => plugin.slug));

  for (const plugin of plugins) {
    try {
      const result = await api.enqueue(plugin, {
        reason: "wordpress.org popular version watcher",
        priority: config.priority,
        pluginCheckVersion: config.pluginCheckVersion,
        scoringModelVersion: SCORING_MODEL_VERSION,
      });

      if (result.queued) {
        queued += 1;
      } else {
        satisfied += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to enqueue ${plugin.slug}: ${(error as Error).message}`);
    }
  }

  let trackedChecked = 0;
  let trackedQueued = 0;
  let trackedSatisfied = 0;
  let trackedFailed = 0;

  if (config.watchTracked) {
    const trackedPlugins = await api.listTrackedPlugins(config.trackedLimit);

    for (const tracked of trackedPlugins) {
      if (popularSlugs.has(tracked.slug)) {
        continue;
      }

      trackedChecked += 1;

      try {
        const plugin = await fetchPluginBySlug(tracked.slug);

        if (!plugin) {
          trackedFailed += 1;
          console.error(`Tracked plugin ${tracked.slug} was not found on WordPress.org.`);
          continue;
        }

        const result = await api.enqueue(plugin, {
          reason: "wordpress.org tracked version watcher",
          priority: config.trackedPriority,
          pluginCheckVersion: config.pluginCheckVersion,
          scoringModelVersion: SCORING_MODEL_VERSION,
        });

        if (result.queued) {
          trackedQueued += 1;
        } else {
          trackedSatisfied += 1;
        }
      } catch (error) {
        trackedFailed += 1;
        console.error(`Failed to check tracked plugin ${tracked.slug}: ${(error as Error).message}`);
      }
    }
  }

  console.log(
    `Scheduler checked ${plugins.length} plugins: ${queued} queued, ${satisfied} already queued/running/audited, ${failed} failed.`,
  );

  if (config.watchTracked) {
    console.log(
      `Scheduler checked ${trackedChecked} tracked non-popular plugins: ${trackedQueued} queued, ${trackedSatisfied} already queued/running/audited, ${trackedFailed} failed.`,
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
