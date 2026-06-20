import type {
  ScanCompletePayload,
  ScanFailPayload,
  ScanJobDto,
  WordPressPluginMetadata,
} from "@pluginscore/core";

type EnqueueOptions = {
  reason: string;
  pluginCheckVersion?: string;
  scoringModelVersion?: string;
};

export class PluginScoreApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken?: string,
  ) {}

  async enqueue(metadata: WordPressPluginMetadata, options: EnqueueOptions) {
    return this.request<{ id: number; queued: boolean }>("/jobs", {
      method: "POST",
      body: JSON.stringify({
        ...metadata,
        reason: options.reason,
        pluginCheckVersion: options.pluginCheckVersion,
        scoringModelVersion: options.scoringModelVersion,
      }),
    });
  }

  async claimNextJob() {
    const response = await this.fetchWithRetry("/jobs/next", {
      headers: this.requestHeaders(),
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Unable to claim job: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as ScanJobDto;
  }

  async completeJob(id: number, payload: ScanCompletePayload) {
    await this.request<void>(`/jobs/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
      expectNoContent: true,
    });
  }

  async failJob(id: number, payload: ScanFailPayload) {
    await this.request<void>(`/jobs/${id}/fail`, {
      method: "POST",
      body: JSON.stringify(payload),
      expectNoContent: true,
    });
  }

  private async request<T>(
    path: string,
    options: RequestInit & { expectNoContent?: boolean } = {},
  ) {
    const response = await this.fetchWithRetry(path, options);

    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
    }

    if (options.expectNoContent || response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async fetchWithRetry(path: string, options: RequestInit = {}) {
    const attempts = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(new URL(path, this.baseUrl), {
          ...options,
          headers: this.requestHeaders(options.headers),
        });

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

  private requestHeaders(headers?: HeadersInit) {
    const merged = new Headers(headers);
    merged.set("content-type", "application/json");

    if (this.internalToken) {
      merged.set("authorization", `Bearer ${this.internalToken}`);
    }

    return merged;
  }
}

function shouldRetryStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
