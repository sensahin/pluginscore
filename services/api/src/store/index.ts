import { MemoryStore } from "./memory-store.js";
import { PostgresStore } from "./postgres-store.js";
import type { PluginScoreStore } from "./types.js";

export type StoreOptions = {
  runningJobTimeoutSeconds?: number;
  runningJobMaxAttempts?: number;
  scanRetryBackoffSeconds?: number;
  scanTerminalTimeoutAttempts?: number;
};

export function createStore(databaseUrl?: string, options: StoreOptions = {}): PluginScoreStore {
  if (databaseUrl) {
    return new PostgresStore(databaseUrl, options);
  }

  return new MemoryStore();
}
