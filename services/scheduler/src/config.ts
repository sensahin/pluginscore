import "dotenv/config";

export type SchedulerConfig = {
  apiUrl: string;
  apiInternalToken?: string;
  limit: number;
  batchSize: number;
  startOffset: number;
  pollIntervalMs: number;
  enqueueDelayMs: number;
  priority: number;
  watchTracked: boolean;
  trackedLimit: number;
  trackedBatchSize: number;
  trackedStartOffset: number;
  trackedPriority: number;
  pluginCheckVersion: string;
};

export function getConfig(): SchedulerConfig {
  return {
    apiUrl: process.env.PLUGINSCORE_API_URL ?? "http://127.0.0.1:4010",
    apiInternalToken: process.env.API_INTERNAL_TOKEN,
    limit: Number.parseInt(process.env.SCHEDULER_LIMIT ?? "1000", 10),
    batchSize: Number.parseInt(process.env.SCHEDULER_BATCH_SIZE ?? "500", 10),
    startOffset: Number.parseInt(process.env.SCHEDULER_START_OFFSET ?? "0", 10),
    pollIntervalMs: Number.parseInt(process.env.SCHEDULER_INTERVAL_SECONDS ?? "3600", 10) * 1000,
    enqueueDelayMs: Number.parseInt(process.env.SCHEDULER_ENQUEUE_DELAY_MS ?? "100", 10),
    priority: Number.parseInt(process.env.SCHEDULER_PRIORITY ?? "100", 10),
    watchTracked: process.env.SCHEDULER_WATCH_TRACKED !== "false",
    trackedLimit: Number.parseInt(process.env.SCHEDULER_TRACKED_LIMIT ?? "5000", 10),
    trackedBatchSize: Number.parseInt(process.env.SCHEDULER_TRACKED_BATCH_SIZE ?? "250", 10),
    trackedStartOffset: Number.parseInt(process.env.SCHEDULER_TRACKED_START_OFFSET ?? "0", 10),
    trackedPriority: Number.parseInt(process.env.SCHEDULER_TRACKED_PRIORITY ?? "80", 10),
    pluginCheckVersion: process.env.PLUGIN_CHECK_VERSION ?? "unknown",
  };
}
