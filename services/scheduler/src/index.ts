import type { WordPressPluginMetadata } from "@pluginscore/core";
import { SCORING_MODEL_VERSION } from "@pluginscore/scoring";
import { fetchPluginBySlug, fetchPopularPlugins } from "@pluginscore/wporg";
import { PluginScoreApiClient } from "./api-client.js";
import { getConfig } from "./config.js";

const command = process.argv[2];
const config = getConfig();
const api = new PluginScoreApiClient(config.apiUrl, config.apiInternalToken);

if (command === "sync-once") {
  await syncOnce({
    popularCursor: config.startOffset,
    trackedCursor: config.trackedStartOffset,
  });
} else if (command === "work") {
  await work();
} else {
  console.error("Usage: tsx src/index.ts <sync-once|work>");
  process.exit(1);
}

async function work() {
  console.log(
    `Scheduler polling top ${config.limit} plugins every ${config.pollIntervalMs / 1000}s, checking up to ${config.batchSize} popular plugins per pass.`,
  );

  let popularCursor = config.startOffset;
  let trackedCursor = config.trackedStartOffset;

  while (true) {
    try {
      const result = await syncOnce({ popularCursor, trackedCursor });
      popularCursor = result.nextPopularCursor;
      trackedCursor = result.nextTrackedCursor;
    } catch (error) {
      console.error(`Scheduler pass failed: ${(error as Error).message}`);
    }

    await sleep(config.pollIntervalMs);
  }
}

type SchedulerCursors = {
  popularCursor: number;
  trackedCursor: number;
};

async function syncOnce(cursors: SchedulerCursors) {
  const plugins = await fetchPopularPlugins(config.limit);
  const popularWindow = selectWindow(plugins, cursors.popularCursor, config.batchSize);
  const popularResult = await enqueueMetadataBatch(popularWindow.items, {
    reason: "wordpress.org popular version watcher",
    priority: config.priority,
  });
  const popularSlugs = new Set(plugins.map((plugin) => plugin.slug));

  let trackedChecked = 0;
  let trackedQueued = 0;
  let trackedSatisfied = 0;
  let trackedFailed = 0;
  let nextTrackedCursor = cursors.trackedCursor;

  if (config.watchTracked) {
    const trackedPlugins = await api.listTrackedPlugins(config.trackedLimit);
    const trackedNonPopular = trackedPlugins.filter((plugin) => !popularSlugs.has(plugin.slug));
    const trackedWindow = selectWindow(
      trackedNonPopular,
      cursors.trackedCursor,
      config.trackedBatchSize,
    );
    const trackedMetadata: WordPressPluginMetadata[] = [];

    for (const tracked of trackedWindow.items) {
      trackedChecked += 1;

      try {
        const plugin = await fetchPluginBySlug(tracked.slug);

        if (!plugin) {
          trackedFailed += 1;
          console.error(`Tracked plugin ${tracked.slug} was not found on WordPress.org.`);
          continue;
        }

        trackedMetadata.push(plugin);
      } catch (error) {
        trackedFailed += 1;
        console.error(`Failed to check tracked plugin ${tracked.slug}: ${(error as Error).message}`);
      }
    }

    const trackedResult = await enqueueMetadataBatch(trackedMetadata, {
      reason: "wordpress.org tracked version watcher",
      priority: config.trackedPriority,
    });

    trackedQueued += trackedResult.queued;
    trackedSatisfied += trackedResult.satisfied;
    trackedFailed += trackedResult.failed;
    nextTrackedCursor = nextCursor(
      cursors.trackedCursor,
      config.trackedBatchSize,
      trackedNonPopular.length,
    );
  }

  console.log(
    `Scheduler checked popular ${describeWindow(popularWindow)}: ${popularResult.queued} queued, ${popularResult.satisfied} already queued/running/audited, ${popularResult.failed} failed.`,
  );

  if (config.watchTracked) {
    console.log(
      `Scheduler checked ${trackedChecked} tracked non-popular plugins: ${trackedQueued} queued, ${trackedSatisfied} already queued/running/audited, ${trackedFailed} failed.`,
    );
  }

  try {
    const retention = await api.runRawReportRetention();

    if (retention.prunedReports > 0) {
      console.log(
        `Raw-report retention pruned ${retention.prunedReports} reports; ${retention.eligibleReports} remain eligible.`,
      );
    }
  } catch (error) {
    console.error(`Raw-report retention failed: ${(error as Error).message}`);
  }

  return {
    nextPopularCursor: nextCursor(cursors.popularCursor, config.batchSize, plugins.length),
    nextTrackedCursor,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepBetweenEnqueues() {
  if (config.enqueueDelayMs <= 0) {
    return Promise.resolve();
  }

  return sleep(config.enqueueDelayMs);
}

async function enqueueMetadataBatch(
  plugins: WordPressPluginMetadata[],
  options: {
    reason: string;
    priority: number;
  },
) {
  if (plugins.length === 0) {
    return {
      checked: 0,
      queued: 0,
      satisfied: 0,
      failed: 0,
      results: [],
    };
  }

  try {
    const result = await api.enqueueMany(plugins.map(sanitizePluginMetadata), {
      reason: options.reason,
      priority: options.priority,
      pluginCheckVersion: config.pluginCheckVersion,
      scoringModelVersion: SCORING_MODEL_VERSION,
    });

    for (const item of result.results) {
      if (item.error) {
        console.error(`Failed to enqueue ${item.slug}: ${item.error}`);
      }
    }

    await sleepBetweenEnqueues();
    return result;
  } catch (error) {
    for (const plugin of plugins) {
      console.error(`Failed to enqueue ${plugin.slug}: ${(error as Error).message}`);
    }

    await sleepBetweenEnqueues();
    return {
      checked: plugins.length,
      queued: 0,
      satisfied: 0,
      failed: plugins.length,
      results: [],
    };
  }
}

function sanitizePluginMetadata(plugin: WordPressPluginMetadata): WordPressPluginMetadata {
  const tags = plugin.tags
    ?.map((tag) => ({
      slug: tag.slug.trim(),
      name: tag.name.trim(),
    }))
    .filter((tag) => tag.slug.length > 0 && tag.slug.length <= 120 && tag.name.length > 0)
    .map((tag) => ({
      slug: tag.slug,
      name: tag.name.slice(0, 160),
    }))
    .slice(0, 20);

  return {
    ...plugin,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
}

function selectWindow<T>(items: T[], cursor: number, size: number) {
  const total = items.length;
  const count = effectiveBatchSize(size, total);
  const start = normalizeCursor(cursor, total);
  const selected: T[] = [];

  for (let index = 0; index < count; index += 1) {
    selected.push(items[(start + index) % total]);
  }

  return {
    items: selected,
    start,
    end: count > 0 ? (start + count - 1) % total : 0,
    total,
    wrapped: count > 0 && start + count > total,
  };
}

function effectiveBatchSize(size: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(total, Math.max(1, size));
}

function normalizeCursor(cursor: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  const normalized = cursor % total;
  return normalized < 0 ? normalized + total : normalized;
}

function nextCursor(cursor: number, size: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (normalizeCursor(cursor, total) + effectiveBatchSize(size, total)) % total;
}

function describeWindow(window: {
  start: number;
  end: number;
  total: number;
  wrapped: boolean;
}) {
  if (window.total === 0) {
    return "0 of 0";
  }

  const range = window.wrapped
    ? `${window.start + 1}-${window.total}, 1-${window.end + 1}`
    : `${window.start + 1}-${window.end + 1}`;

  return `${range} of ${window.total}`;
}
