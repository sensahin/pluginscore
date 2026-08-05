import { MemoryStore } from "./memory-store.js";
import { PostgresStore } from "./postgres-store.js";
import type { PluginScoreStore } from "./types.js";

export type StoreOptions = {
  runningJobTimeoutSeconds?: number;
  runningJobMaxAttempts?: number;
  scanRetryBackoffSeconds?: number;
  scanTerminalTimeoutAttempts?: number;
  scanTerminalFailureAttempts?: number;
  ignoredPluginSlugs?: string[];
  pluginCheckVersion?: string;
  externalConnectionAnalysisDisabled?: boolean;
  rawReportRetentionDays?: number;
  rawReportRetentionBatchSize?: number;
};

export function createStore(databaseUrl?: string, options: StoreOptions = {}): PluginScoreStore {
  if (databaseUrl) {
    return new PostgresStore(databaseUrl, options);
  }

  return new MemoryStore(options.ignoredPluginSlugs);
}
