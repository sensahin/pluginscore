import type {
  ApiStats,
  AuditFindingsRetentionSummary,
  AuthorDetail,
  AuthorSummary,
  OperationsSummary,
  PaginatedResult,
  PluginSearchSummary,
  PluginScoreHistory,
  ScanCompletePayload,
  ScanFailPayload,
  ScanJobDto,
  TagDetail,
  TagSummary,
  TrackedPluginSummary,
} from "@pluginscore/core";
import { findIssue, findPlugin, issues, plugins, queue as sampleQueue } from "@pluginscore/core/sample-data";
import type {
  EnqueueJobInput,
  ListQueueOptions,
  ListAuthorsOptions,
  ListRecentSearchesOptions,
  ListTagsOptions,
  GetTagOptions,
  GetPluginHistoryOptions,
  ListPluginsOptions,
  ListTrackedPluginsOptions,
  PluginScoreStore,
} from "./types.js";

type MemoryJob = ScanJobDto & {
  status: "queued" | "running" | "complete" | "failed";
  priority: number;
  lastError?: string;
};

type CompletedAudit = {
  slug: string;
  version: string;
  pluginCheckVersion: string;
  scoringModelVersion: string;
};

type SearchEvent = {
  slug: string;
  searchedAt: string;
};

type SamplePlugin = (typeof plugins)[number];

export class MemoryStore implements PluginScoreStore {
  private jobs: MemoryJob[] = [];
  private completedAudits: CompletedAudit[] = [];
  private searchEvents: SearchEvent[] = [];
  private nextJobId = 1;

  async health() {
    return { ok: true as const, mode: "memory" as const };
  }

  async stats(): Promise<ApiStats> {
    const queueJobs = this.jobs.length
      ? this.jobs
      : sampleQueue.map((job, index) => ({
          id: index,
          pluginId: index,
          slug: job.plugin,
          name: job.plugin,
          targetVersion: job.version,
          reason: job.reason,
          downloadUrl: "",
          attempts: 0,
          priority: 100,
          status: job.state,
        }));

    return {
      indexedPlugins: plugins.length,
      auditedPlugins: plugins.filter((plugin) => plugin.latestAudit?.status === "complete").length,
      completedScans: plugins.filter((plugin) => plugin.latestAudit?.status === "complete").length,
      queuedJobs: queueJobs.filter((job) => job.status === "queued").length,
      runningJobs: queueJobs.filter((job) => job.status === "running").length,
      failedJobs: queueJobs.filter((job) => job.status === "failed").length,
      issueCodes: issues.length,
      recentSearches: this.searchEvents.length,
    };
  }

  async auditFindingsRetention(): Promise<AuditFindingsRetentionSummary> {
    return {
      policy: "latest_scan_findings_per_plugin",
      dryRun: true,
      totalFindingRows: 0,
      currentFindingRows: 0,
      staleFindingRows: 0,
      currentAuditRuns: 0,
      staleAuditRuns: 0,
      pluginsWithStaleFindings: 0,
      auditFindingsTableBytes: 0,
      estimatedReusableBytes: 0,
    };
  }

  async operationsSummary(): Promise<OperationsSummary> {
    const stats = await this.stats();
    const auditedPlugins = stats.auditedPlugins ?? stats.completedScans;
    const indexedPlugins = stats.indexedPlugins;

    return {
      generatedAt: new Date().toISOString(),
      coverage: {
        indexedPlugins,
        auditedPlugins,
        unscannedPlugins: Math.max(0, indexedPlugins - auditedPlugins),
        completedScans: stats.completedScans,
        coveragePercent: indexedPlugins > 0 ? Math.round((auditedPlugins / indexedPlugins) * 1000) / 10 : 0,
        queuedJobs: stats.queuedJobs,
        runningJobs: stats.runningJobs,
        failedJobs: stats.failedJobs,
        userSubmittedQueuedJobs: 0,
      },
      queue: {
        queuedReadyJobs: stats.queuedJobs,
        queuedDelayedJobs: 0,
        staleRunningJobs: 0,
        completedScans24h: 0,
        completedScansPerHour24h: 0,
        running: [],
      },
      storage: {
        databaseBytes: 0,
        auditFindingsBytes: 0,
        auditRunsBytes: 0,
        scoreSnapshotsBytes: 0,
        scanJobsBytes: 0,
        rawReportJsonBytes: 0,
        stderrBytes: 0,
        totalFindingRows: 0,
      },
      versions: {
        apiPluginCheckVersion: "sample",
        scoringModelVersion: "sample",
        pluginCheckVersions: [],
        scoringModelVersions: [],
      },
      retryPolicy: {
        runningJobTimeoutSeconds: 0,
        runningJobMaxAttempts: 0,
        scanRetryBackoffSeconds: 0,
        scanTerminalTimeoutAttempts: 0,
      },
      failures: {
        failedAuditRuns: 0,
        timeoutAuditRuns: 0,
        repeatedTimeoutPlugins: 0,
        recent: [],
      },
      userSubmissions: {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        recent: [],
      },
      recentCompleted: [],
    };
  }

  async listPlugins(options: ListPluginsOptions): Promise<PaginatedResult<SamplePlugin>> {
    const normalizedQuery = normalizeSearchQuery(options.query);
    const filteredBySearch = normalizedQuery
      ? plugins.filter((plugin) => pluginMatches(plugin, normalizedQuery))
      : plugins;
    const filteredByAuthor = options.author
      ? filteredBySearch.filter((plugin) => plugin.author?.toLowerCase() === options.author?.trim().toLowerCase())
      : filteredBySearch;
    const filtered = options.auditedOnly
      ? filteredByAuthor.filter((plugin) => plugin.latestAudit?.status === "complete")
      : filteredByAuthor;
    const issueFiltered = options.issueCode || options.issueFamily
      ? filtered.filter((plugin) => plugin.findings > 0 && plugin.latestAudit?.status === "complete")
      : filtered;
    const sorted = [...issueFiltered].sort((a, b) => {
      if (options.sort === "relevance_desc" && normalizedQuery) {
        return (
          pluginRelevanceRank(a, normalizedQuery) - pluginRelevanceRank(b, normalizedQuery) ||
          comparePluginPopularity(a, b)
        );
      }
      if (options.sort === "score_asc") return a.score - b.score || a.slug.localeCompare(b.slug);
      if (options.sort === "issues_desc") return b.findings - a.findings || a.slug.localeCompare(b.slug);
      if (options.sort === "installs_desc") return parseDownloads(b.activeInstalls) - parseDownloads(a.activeInstalls) || a.slug.localeCompare(b.slug);
      if (options.sort === "downloads_desc") return parseDownloads(b.downloads) - parseDownloads(a.downloads) || a.slug.localeCompare(b.slug);
      if (options.sort === "updated_desc") return b.lastUpdated.localeCompare(a.lastUpdated) || a.slug.localeCompare(b.slug);
      if (options.sort === "delta_desc") return scoreDelta(b) - scoreDelta(a) || a.slug.localeCompare(b.slug);
      if (options.sort === "scanned_desc") {
        return auditCompletedAt(b).localeCompare(auditCompletedAt(a)) || a.slug.localeCompare(b.slug);
      }
      return b.score - a.score || a.slug.localeCompare(b.slug);
    });

    const tagFiltered = options.tag
      ? sorted.filter((plugin) => plugin.tags?.some((tag) => tag.slug === normalizeTagSlug(options.tag ?? "")))
      : sorted;

    return paginateItems(tagFiltered, options.page, options.perPage);
  }

  async getPlugin(slug: string) {
    return findPlugin(slug) ?? null;
  }

  async getPluginHistory(slug: string, _options: GetPluginHistoryOptions): Promise<PluginScoreHistory | null> {
    const plugin = findPlugin(slug);

    if (!plugin) {
      return null;
    }

    if (plugin.latestAudit?.status !== "complete") {
      return { slug: plugin.slug, history: [] };
    }

    return {
      slug: plugin.slug,
      history: [
        {
          auditRunId: plugin.latestAudit.id,
          scannedAt: plugin.latestAudit.completedAt ?? new Date().toISOString(),
          pluginVersion: plugin.latestAudit.pluginVersion,
          pluginCheckVersion: plugin.latestAudit.pluginCheckVersion,
          scoringModelVersion: plugin.latestAudit.scoringModelVersion,
          score: plugin.score,
          scores: plugin.scores ?? {
            security: plugin.score,
            repo: plugin.score,
            performance: plugin.score,
            maintainability: plugin.score,
          },
          findings: plugin.findings,
          errors: plugin.errors,
          warnings: plugin.warnings,
          durationMs: plugin.latestAudit.durationMs,
        },
      ],
    };
  }

  async recordSearch(slug: string) {
    const plugin = findPlugin(slug);
    if (!plugin) {
      return { recorded: false };
    }

    this.searchEvents.unshift({
      slug: plugin.slug,
      searchedAt: new Date().toISOString(),
    });

    return { recorded: true };
  }

  async listRecentSearches(options: ListRecentSearchesOptions) {
    const latestBySlug = new Map<string, PluginSearchSummary>();

    for (const event of this.searchEvents) {
      const existing = latestBySlug.get(event.slug);
      const plugin = findPlugin(event.slug);

      if (!plugin) {
        continue;
      }

      latestBySlug.set(event.slug, {
        ...plugin,
        searchedAt: existing?.searchedAt ?? event.searchedAt,
        searchCount: (existing?.searchCount ?? 0) + 1,
      });
    }

    const recent = [...latestBySlug.values()]
      .sort((a, b) => b.searchedAt.localeCompare(a.searchedAt))
      .slice(0, options.limit);

    if (recent.length > 0) {
      return recent;
    }

    return plugins.slice(0, options.limit).map((plugin, index) => ({
      ...plugin,
      searchedAt: new Date(Date.now() - index * 60_000).toISOString(),
      searchCount: 1,
    }));
  }

  async listAuthors(options: ListAuthorsOptions): Promise<AuthorSummary[]> {
    const byAuthor = new Map<string, SamplePlugin[]>();

    for (const plugin of plugins) {
      if (!plugin.author) {
        continue;
      }

      const existing = byAuthor.get(plugin.author) ?? [];
      existing.push(plugin);
      byAuthor.set(plugin.author, existing);
    }

    return [...byAuthor.entries()]
      .map(([name, authorPlugins]) => pluginsToAuthorDetail(name, authorPlugins))
      .sort((a, b) => b.pluginCount - a.pluginCount || b.activeInstalls - a.activeInstalls || a.name.localeCompare(b.name))
      .slice(0, options.limit)
      .map(({ plugins: _plugins, ...summary }) => summary);
  }

  async getAuthor(authorName: string): Promise<AuthorDetail | null> {
    const normalized = authorName.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const authorPlugins = plugins
      .filter((plugin) => plugin.author?.toLowerCase() === normalized)
      .sort((a, b) => parseDownloads(b.activeInstalls) - parseDownloads(a.activeInstalls) || a.name.localeCompare(b.name));

    return authorPlugins.length ? pluginsToAuthorDetail(authorPlugins[0]?.author ?? authorName, authorPlugins) : null;
  }

  async listTags(options: ListTagsOptions): Promise<TagSummary[]> {
    return sampleTagSummaries()
      .filter((tag) => tag.pluginCount >= (options.minimumPlugins ?? 1))
      .sort((a, b) => b.pluginCount - a.pluginCount || b.activeInstalls - a.activeInstalls || a.name.localeCompare(b.name))
      .slice(0, options.limit);
  }

  async getTag(tagSlug: string, options: GetTagOptions): Promise<TagDetail | null> {
    const normalized = normalizeTagSlug(tagSlug);
    const summary = sampleTagSummaries().find((tag) => tag.slug === normalized);

    if (!summary) {
      return null;
    }

    const auditedOnly = options.sort === "score_desc" || options.sort === "scanned_desc" || options.sort === "issues_desc";
    const tagPlugins = plugins
      .filter((plugin) => plugin.tags?.some((tag) => tag.slug === normalized))
      .filter((plugin) => !auditedOnly || plugin.latestAudit?.status === "complete")
      .sort((a, b) => {
        if (options.sort === "installs_desc") return parseDownloads(b.activeInstalls) - parseDownloads(a.activeInstalls);
        if (options.sort === "scanned_desc") return auditCompletedAt(b).localeCompare(auditCompletedAt(a));
        if (options.sort === "issues_desc") return b.findings - a.findings;
        return b.score - a.score;
      })
      .slice(0, options.limit);

    return {
      ...summary,
      plugins: tagPlugins,
    };
  }

  async listQueue(options: ListQueueOptions) {
    if (this.jobs.length === 0) {
      return sampleQueue.slice(0, options.limit);
    }

    return [...this.jobs]
      .sort((a, b) => {
        const statusRank = (status: MemoryJob["status"]) =>
          ({ running: 0, queued: 1, failed: 2, complete: 3 })[status];
        return statusRank(a.status) - statusRank(b.status) || b.id - a.id;
      })
      .slice(0, options.limit)
      .map((job) => ({
        plugin: job.slug,
        version: job.targetVersion,
        state: job.status,
        reason: job.reason,
        runtime: job.status === "queued" ? "-" : "0s",
      }));
  }

  async listIssues() {
    return issues;
  }

  async getIssue(code: string) {
    return findIssue(code) ?? null;
  }

  async listTrackedPlugins(options: ListTrackedPluginsOptions): Promise<TrackedPluginSummary[]> {
    return plugins
      .slice(0, options.limit)
      .map((plugin) => ({
        slug: plugin.slug,
        version: plugin.version,
        updatedAt: plugin.latestAudit?.completedAt,
      }));
  }

  async enqueueJob(input: EnqueueJobInput) {
    const existing = this.jobs.find(
      (job) =>
        job.slug === input.slug &&
        job.targetVersion === input.version &&
        ["queued", "running"].includes(job.status),
    );

    if (existing) {
      return { id: existing.id, queued: false };
    }

    const completed = this.completedAudits.find(
      (audit) =>
        audit.slug === input.slug &&
        audit.version === input.version &&
        (!input.pluginCheckVersion || audit.pluginCheckVersion === input.pluginCheckVersion) &&
        (!input.scoringModelVersion || audit.scoringModelVersion === input.scoringModelVersion),
    );

    if (completed && !input.force) {
      return { id: 0, queued: false };
    }

    const id = this.nextJobId++;
    this.jobs.push({
      id,
      pluginId: id,
      slug: input.slug,
      name: input.name,
      targetVersion: input.version,
      reason: input.reason,
      downloadUrl: input.downloadLink,
      attempts: 0,
      priority: input.priority ?? 100,
      status: "queued",
    });

    return { id, queued: true };
  }

  async claimNextJob() {
    const job = this.jobs
      .filter((candidate) => candidate.status === "queued")
      .sort((a, b) => a.priority - b.priority || a.id - b.id)[0];

    if (!job) {
      return null;
    }

    job.status = "running";
    job.attempts += 1;

    return {
      id: job.id,
      pluginId: job.pluginId,
      slug: job.slug,
      name: job.name,
      targetVersion: job.targetVersion,
      reason: job.reason,
      downloadUrl: job.downloadUrl,
      attempts: job.attempts,
    };
  }

  async completeJob(id: number, _payload: ScanCompletePayload) {
    const job = this.jobs.find((candidate) => candidate.id === id);
    if (job) {
      job.status = "complete";
      this.completedAudits.push({
        slug: job.slug,
        version: _payload.pluginVersion,
        pluginCheckVersion: _payload.pluginCheckVersion,
        scoringModelVersion: _payload.scoringModelVersion,
      });
    }
  }

  async failJob(id: number, payload: ScanFailPayload) {
    const job = this.jobs.find((candidate) => candidate.id === id);
    if (job) {
      job.status = "failed";
      job.lastError = payload.message;
    }
  }

  async close() {}
}

function auditCompletedAt(plugin: SamplePlugin) {
  return plugin.latestAudit?.completedAt ?? "";
}

function pluginsToAuthorDetail(name: string, authorPlugins: SamplePlugin[]): AuthorDetail {
  const audited = authorPlugins.filter((plugin) => plugin.latestAudit?.status === "complete");
  const averageScore = audited.length
    ? Math.round(audited.reduce((sum, plugin) => sum + plugin.score, 0) / audited.length)
    : undefined;

  return {
    name,
    pluginCount: authorPlugins.length,
    auditedPluginCount: audited.length,
    activeInstalls: authorPlugins.reduce((sum, plugin) => sum + parseDownloads(plugin.activeInstalls), 0),
    downloads: authorPlugins.reduce((sum, plugin) => sum + parseDownloads(plugin.downloads), 0),
    averageScore,
    totalFindings: authorPlugins.reduce((sum, plugin) => sum + plugin.findings, 0),
    totalErrors: authorPlugins.reduce((sum, plugin) => sum + plugin.errors, 0),
    totalWarnings: authorPlugins.reduce((sum, plugin) => sum + plugin.warnings, 0),
    plugins: authorPlugins,
  };
}

function sampleTagSummaries(): TagSummary[] {
  const byTag = new Map<string, { slug: string; name: string; plugins: SamplePlugin[] }>();

  for (const plugin of plugins) {
    for (const tag of plugin.tags ?? []) {
      const existing = byTag.get(tag.slug) ?? { ...tag, plugins: [] };
      existing.plugins.push(plugin);
      byTag.set(tag.slug, existing);
    }
  }

  return [...byTag.values()].map((tag) => {
    const audited = tag.plugins.filter((plugin) => plugin.latestAudit?.status === "complete");
    const averageScore = audited.length
      ? Math.round(audited.reduce((sum, plugin) => sum + plugin.score, 0) / audited.length)
      : undefined;

    return {
      slug: tag.slug,
      name: tag.name,
      pluginCount: tag.plugins.length,
      auditedPluginCount: audited.length,
      activeInstalls: tag.plugins.reduce((sum, plugin) => sum + parseDownloads(plugin.activeInstalls), 0),
      averageScore,
    };
  });
}

function parseDownloads(downloads: string) {
  const normalized = downloads.toLowerCase().replace("+", "").trim();
  const value = Number.parseFloat(normalized);

  if (normalized.endsWith("m")) return value * 1_000_000;
  if (normalized.endsWith("k")) return value * 1_000;

  return value;
}

function normalizeTagSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSearchQuery(query?: string) {
  const normalized = query ? normalizeSearchText(query) : undefined;
  return normalized ? normalized : undefined;
}

function scoreDelta(plugin: (typeof plugins)[number]) {
  return plugin.score - plugin.previousScore;
}

function pluginMatches(plugin: (typeof plugins)[number], query: string) {
  return searchablePluginValues(plugin).some((value) => value.includes(query));
}

function pluginRelevanceRank(plugin: (typeof plugins)[number], query: string) {
  const name = normalizeSearchText(plugin.name);
  const slug = normalizeSearchText(plugin.slug);
  const author = normalizeSearchText(plugin.author ?? "");
  const description = normalizeSearchText(plugin.shortDescription ?? "");
  const tags = (plugin.tags ?? []).flatMap((tag) => [
    normalizeSearchText(tag.name),
    normalizeSearchText(tag.slug),
  ]);

  if (name === query) return 0;
  if (slug === query) return 1;
  if (name.startsWith(query)) return 2;
  if (slug.startsWith(query)) return 3;
  if (tags.some((tag) => tag === query)) return 4;
  if (tags.some((tag) => tag.startsWith(query))) return 5;
  if (name.includes(query)) return 6;
  if (slug.includes(query)) return 7;
  if (author.startsWith(query)) return 8;
  if (tags.some((tag) => tag.includes(query))) return 9;
  if (description.includes(query)) return 10;

  return 11;
}

function comparePluginPopularity(a: (typeof plugins)[number], b: (typeof plugins)[number]) {
  return (
    parseDownloads(b.activeInstalls) - parseDownloads(a.activeInstalls) ||
    parseDownloads(b.downloads) - parseDownloads(a.downloads) ||
    (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    b.lastUpdated.localeCompare(a.lastUpdated) ||
    b.score - a.score ||
    a.slug.localeCompare(b.slug)
  );
}

function searchablePluginValues(plugin: (typeof plugins)[number]) {
  return [
    plugin.slug,
    plugin.name,
    plugin.shortDescription,
    plugin.author,
    ...(plugin.tags ?? []).flatMap((tag) => [tag.slug, tag.name]),
  ].map((value) => normalizeSearchText(value ?? ""));
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paginateItems<T>(items: T[], page: number, perPage: number): PaginatedResult<T> {
  const safePerPage = Math.max(1, perPage);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePerPage;
  const pageItems = items.slice(start, start + safePerPage);

  return {
    items: pageItems,
    page: safePage,
    perPage: safePerPage,
    total,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
    nextCursor: safePage < totalPages ? `page:${safePage + 1}` : undefined,
  };
}
