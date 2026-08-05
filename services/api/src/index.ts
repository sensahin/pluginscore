import { getConfig } from "./config.js";
import { createServer } from "./server.js";
import { createStore } from "./store/index.js";

const config = getConfig();
const store = createStore(config.databaseUrl, {
  runningJobTimeoutSeconds: config.runningJobTimeoutSeconds,
  runningJobMaxAttempts: config.runningJobMaxAttempts,
  scanRetryBackoffSeconds: config.scanRetryBackoffSeconds,
  scanTerminalTimeoutAttempts: config.scanTerminalTimeoutAttempts,
  scanTerminalFailureAttempts: config.scanTerminalFailureAttempts,
  ignoredPluginSlugs: config.ignoredPluginSlugs,
  pluginCheckVersion: config.pluginCheckVersion,
  externalConnectionAnalysisDisabled: config.externalConnectionAnalysisDisabled,
  rawReportRetentionDays: config.rawReportRetentionDays,
  rawReportRetentionBatchSize: config.rawReportRetentionBatchSize,
});
const server = await createServer(config, store);
const storageSnapshotInterval = setInterval(() => {
  void store.captureStorageSnapshot().catch((error: unknown) => {
    server.log.warn({ error }, "Unable to capture database storage snapshot");
  });
}, 60 * 60 * 1000);
storageSnapshotInterval.unref();

server.addHook("onClose", async () => {
  clearInterval(storageSnapshotInterval);
});

try {
  await server.listen({ host: config.host, port: config.port });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

void store.captureStorageSnapshot().catch((error: unknown) => {
  server.log.warn({ error }, "Unable to capture initial database storage snapshot");
});
