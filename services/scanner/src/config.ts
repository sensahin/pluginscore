import "dotenv/config";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ScannerConfig = {
  apiUrl: string;
  apiInternalToken?: string;
  seedLimit: number;
  scanIdleMs: number;
  scanTimeoutMs: number;
  tmpDir: string;
  pluginCheckCommand?: string;
  pluginCheckVersion: string;
  externalConnectionAnalysisTimeoutMs: number;
};

export function getConfig(): ScannerConfig {
  return {
    apiUrl: process.env.PLUGINSCORE_API_URL ?? "http://127.0.0.1:4010",
    apiInternalToken: process.env.API_INTERNAL_TOKEN,
    seedLimit: Number.parseInt(process.env.SEED_LIMIT ?? "100", 10),
    scanIdleMs: Number.parseInt(process.env.SCAN_IDLE_SECONDS ?? "60", 10) * 1000,
    scanTimeoutMs: Number.parseInt(process.env.SCAN_TIMEOUT_SECONDS ?? "600", 10) * 1000,
    tmpDir: process.env.SCAN_TMP_DIR ?? join(tmpdir(), "pluginscore-scans"),
    pluginCheckCommand: process.env.PLUGIN_CHECK_COMMAND,
    pluginCheckVersion: process.env.PLUGIN_CHECK_VERSION ?? "unknown",
    externalConnectionAnalysisTimeoutMs: Number.parseInt(
      process.env.EXTERNAL_CONNECTION_ANALYSIS_TIMEOUT_SECONDS ?? "15",
      10,
    ) * 1000,
  };
}
