import "dotenv/config";

export type ApiConfig = {
  host: string;
  port: number;
  databaseUrl?: string;
  corsOrigin: string | string[];
  internalToken?: string;
  searchRateLimitPerMinute: number;
  submissionRateLimitPerMinute: number;
  reportRateLimitPerMinute: number;
  reportIpHashSecret?: string;
  bodyLimitBytes: number;
  runningJobTimeoutSeconds: number;
  runningJobMaxAttempts: number;
  scanRetryBackoffSeconds: number;
  scanTerminalTimeoutAttempts: number;
  pluginCheckVersion: string;
  externalConnectionAnalysisDisabled: boolean;
};

export function getConfig(): ApiConfig {
  return {
    host: process.env.API_HOST ?? "127.0.0.1",
    port: Number.parseInt(process.env.PORT ?? "4010", 10),
    databaseUrl: process.env.DATABASE_URL,
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
    internalToken: process.env.API_INTERNAL_TOKEN,
    searchRateLimitPerMinute: Number.parseInt(process.env.SEARCH_RATE_LIMIT_PER_MINUTE ?? "60", 10),
    submissionRateLimitPerMinute: Number.parseInt(process.env.SUBMISSION_RATE_LIMIT_PER_MINUTE ?? "6", 10),
    reportRateLimitPerMinute: Number.parseInt(process.env.REPORT_RATE_LIMIT_PER_MINUTE ?? "4", 10),
    reportIpHashSecret: process.env.REPORT_IP_HASH_SECRET || process.env.API_INTERNAL_TOKEN,
    bodyLimitBytes: Number.parseInt(process.env.API_BODY_LIMIT_BYTES ?? "52428800", 10),
    runningJobTimeoutSeconds: Number.parseInt(process.env.RUNNING_JOB_TIMEOUT_SECONDS ?? "1800", 10),
    runningJobMaxAttempts: Number.parseInt(process.env.RUNNING_JOB_MAX_ATTEMPTS ?? "3", 10),
    scanRetryBackoffSeconds: Number.parseInt(process.env.SCAN_RETRY_BACKOFF_SECONDS ?? "21600", 10),
    scanTerminalTimeoutAttempts: Number.parseInt(process.env.SCAN_TERMINAL_TIMEOUT_ATTEMPTS ?? "2", 10),
    pluginCheckVersion: process.env.PLUGIN_CHECK_VERSION ?? "unknown",
    externalConnectionAnalysisDisabled: process.env.EXTERNAL_CONNECTION_ANALYSIS_DISABLED === "true",
  };
}

function parseCorsOrigin(value?: string) {
  if (!value) {
    return [
      "https://pluginscore.com",
      "https://www.pluginscore.com",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ];
  }

  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}
