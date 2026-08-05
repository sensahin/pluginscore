import type {
  RawReportRetentionSummary,
  TrackedPluginSummary,
  WordPressPluginMetadata,
} from "@pluginscore/core";

type EnqueueOptions = {
  reason: string;
  priority: number;
  pluginCheckVersion: string;
  scoringModelVersion: string;
};

type BulkEnqueueResult = {
  checked: number;
  queued: number;
  satisfied: number;
  failed: number;
  results: Array<{
    slug: string;
    id?: number;
    queued: boolean;
    error?: string;
  }>;
};

export class PluginScoreApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken?: string,
  ) {}

  async enqueue(metadata: WordPressPluginMetadata, options: EnqueueOptions) {
    const response = await this.fetchWithRetry("/jobs", {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify({
        ...metadata,
        reason: options.reason,
        priority: options.priority,
        pluginCheckVersion: options.pluginCheckVersion,
        scoringModelVersion: options.scoringModelVersion,
      }),
    });

    if (!response.ok) {
      throw new Error(`/jobs failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as { id: number; queued: boolean };
  }

  async enqueueMany(metadata: WordPressPluginMetadata[], options: EnqueueOptions) {
    if (metadata.length === 0) {
      return {
        checked: 0,
        queued: 0,
        satisfied: 0,
        failed: 0,
        results: [],
      } satisfies BulkEnqueueResult;
    }

    const response = await this.fetchWithRetry("/jobs/bulk", {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify({
        jobs: metadata.map((plugin) => ({
          ...plugin,
          reason: options.reason,
          priority: options.priority,
          pluginCheckVersion: options.pluginCheckVersion,
          scoringModelVersion: options.scoringModelVersion,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`/jobs/bulk failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as BulkEnqueueResult;
  }

  async listTrackedPlugins(limit: number) {
    const response = await this.fetchWithRetry(`/plugins/tracked?limit=${limit}`, {
      headers: this.requestHeaders(),
    });

    if (!response.ok) {
      throw new Error(`/plugins/tracked failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as TrackedPluginSummary[];
  }

  async runRawReportRetention() {
    const response = await fetch(new URL("/maintenance/raw-report-retention", this.baseUrl), {
      method: "POST",
      headers: this.requestHeaders(),
      body: "{}",
      signal: AbortSignal.timeout(40_000),
    });

    if (!response.ok) {
      throw new Error(
        `/maintenance/raw-report-retention failed: ${response.status} ${await response.text()}`,
      );
    }

    return (await response.json()) as RawReportRetentionSummary;
  }

  private async fetchWithRetry(path: string, options: RequestInit = {}) {
    const attempts = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(new URL(path, this.baseUrl), options);

        if (response.ok || !shouldRetryStatus(response.status) || attempt === attempts) {
          return response;
        }

        lastError = new Error(`${path} returned retryable status ${response.status}`);
      } catch (error) {
        lastError = error as Error;

        if (attempt === attempts) {
          throw lastError;
        }
      }

      await sleep(500 * attempt);
    }

    throw lastError ?? new Error(`${path} failed`);
  }

  private requestHeaders() {
    const headers = new Headers();
    headers.set("content-type", "application/json");

    if (this.internalToken) {
      headers.set("authorization", `Bearer ${this.internalToken}`);
    }

    return headers;
  }
}

function shouldRetryStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
