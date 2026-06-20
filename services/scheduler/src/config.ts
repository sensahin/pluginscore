import "dotenv/config";

export type SchedulerConfig = {
  apiUrl: string;
  apiInternalToken?: string;
  limit: number;
  pollIntervalMs: number;
  priority: number;
  watchTracked: boolean;
  trackedLimit: number;
  trackedPriority: number;
  pluginCheckVersion: string;
};

export function getConfig(): SchedulerConfig {
  return {
    apiUrl: process.env.PLUGINSCORE_API_URL ?? "http://127.0.0.1:4010",
    apiInternalToken: process.env.API_INTERNAL_TOKEN,
    limit: Number.parseInt(process.env.SCHEDULER_LIMIT ?? "1000", 10),
    pollIntervalMs: Number.parseInt(process.env.SCHEDULER_INTERVAL_SECONDS ?? "3600", 10) * 1000,
    priority: Number.parseInt(process.env.SCHEDULER_PRIORITY ?? "100", 10),
    watchTracked: process.env.SCHEDULER_WATCH_TRACKED !== "false",
    trackedLimit: Number.parseInt(process.env.SCHEDULER_TRACKED_LIMIT ?? "5000", 10),
    trackedPriority: Number.parseInt(process.env.SCHEDULER_TRACKED_PRIORITY ?? "80", 10),
    pluginCheckVersion: process.env.PLUGIN_CHECK_VERSION ?? "unknown",
  };
}
