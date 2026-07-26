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
});
const server = await createServer(config, store);

try {
  await server.listen({ host: config.host, port: config.port });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
