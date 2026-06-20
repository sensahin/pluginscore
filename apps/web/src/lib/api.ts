import type {
  ApiStats,
  AuthorDetail,
  AuthorSummary,
  IssueSummary,
  PaginatedResult,
  PluginDetail,
  PluginSearchSummary,
  PluginScoreHistory,
  PluginSummary,
  QueueJob,
  TagDetail,
  TagSummary,
} from "@pluginscore/core";
import { enrichIssueSummary } from "@pluginscore/core";
import {
  findIssue as findSampleIssue,
  findPlugin as findSamplePlugin,
  issues as sampleIssues,
  plugins as samplePlugins,
  queue as sampleQueue,
} from "@pluginscore/core/sample-data";

type PluginSort =
  | "score_desc"
  | "score_asc"
  | "downloads_desc"
  | "installs_desc"
  | "updated_desc"
  | "scanned_desc"
  | "issues_desc"
  | "delta_desc"
  | "relevance_desc";
type TagSort = "score_desc" | "installs_desc" | "scanned_desc" | "issues_desc";
type PluginsPageOptions = {
  page?: number;
  perPage?: number;
  sort?: PluginSort;
  query?: string;
  audited?: boolean;
  tag?: string;
  author?: string;
  issueCode?: string;
  issueFamily?: string;
};
type HealthStatus = {
  ok: boolean;
  mode?: "memory" | "postgres";
  apiUrl?: string;
};

const apiBaseUrl = process.env.PLUGINSCORE_API_URL;
const DEFAULT_API_REVALIDATE_SECONDS = 1_800;
const PLUGIN_DETAIL_REVALIDATE_SECONDS = 900;

const sampleStats: ApiStats = {
  indexedPlugins: samplePlugins.length,
  auditedPlugins: samplePlugins.filter((plugin) => plugin.latestAudit?.status === "complete").length,
  completedScans: samplePlugins.filter((plugin) => plugin.latestAudit?.status === "complete").length,
  queuedJobs: sampleQueue.filter((job) => job.state === "queued").length,
  runningJobs: sampleQueue.filter((job) => job.state === "running").length,
  failedJobs: sampleQueue.filter((job) => job.state === "failed").length,
  issueCodes: sampleIssues.length,
  recentSearches: 0,
};

export async function getPlugins({
  limit = 50,
  sort = "score_desc",
  query,
  audited,
  tag,
}: {
  limit?: number;
  sort?: PluginSort;
  query?: string;
  audited?: boolean;
  tag?: string;
} = {}) {
  const page = await getPluginsPage({
    page: 1,
    perPage: limit,
    sort,
    query,
    audited,
    tag,
  });

  return page.items;
}

export async function getPluginsPage({
  page = 1,
  perPage = 50,
  sort = "score_desc",
  query,
  audited,
  tag,
  author,
  issueCode,
  issueFamily,
}: PluginsPageOptions = {}): Promise<PaginatedResult<PluginSummary>> {
  const normalizedPage = Math.max(1, page);
  const normalizedPerPage = Math.max(1, perPage);
  const fallbackItems = buildPluginsFallback({
    sort,
    query,
    audited,
    tag,
    author,
    issueCode,
    issueFamily,
  });
  const fallback = paginateFallback(fallbackItems, normalizedPage, normalizedPerPage);
  const params = new URLSearchParams({
    page: String(normalizedPage),
    perPage: String(normalizedPerPage),
    sort,
  });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (audited) {
    params.set("audited", "true");
  }

  if (tag) {
    params.set("tag", tag);
  }

  if (author?.trim()) {
    params.set("author", author.trim());
  }

  if (issueCode?.trim()) {
    params.set("issueCode", issueCode.trim());
  }

  if (issueFamily?.trim()) {
    params.set("issueFamily", issueFamily.trim());
  }

  const result = await fetchFromApi<PaginatedResult<PluginSummary> | PluginSummary[]>(
    `/plugins?${params.toString()}`,
    fallback,
  );

  return Array.isArray(result)
    ? paginateFallback(result, normalizedPage, normalizedPerPage)
    : result;
}

export async function getTags(limit = 100, minimumPlugins = 1) {
  return fetchFromApi<TagSummary[]>(
    `/tags?limit=${limit}&minimumPlugins=${minimumPlugins}`,
    sampleTags(limit, minimumPlugins),
  );
}

export async function getTag(tagSlug: string, sort: TagSort = "score_desc", limit = 100) {
  const fallback = sampleTag(tagSlug, sort, limit);

  return fetchFromApi<TagDetail | null>(
    `/tags/${encodeURIComponent(tagSlug)}?sort=${sort}&limit=${limit}`,
    fallback,
  );
}

export async function getPlugin(slug: string) {
  return fetchFromApi<PluginDetail | null>(
    `/plugins/${encodeURIComponent(slug)}`,
    findSamplePlugin(slug) ?? null,
    { revalidate: PLUGIN_DETAIL_REVALIDATE_SECONDS },
  );
}

export async function getPluginScoreHistory(slug: string, limit = 20) {
  return fetchFromApi<PluginScoreHistory | null>(
    `/plugins/${encodeURIComponent(slug)}/history?limit=${limit}`,
    samplePluginScoreHistory(slug),
    { revalidate: PLUGIN_DETAIL_REVALIDATE_SECONDS },
  );
}

export async function getStats() {
  return fetchFromApi<ApiStats>("/stats", sampleStats);
}

export async function getFreshStats() {
  return fetchFromApi<ApiStats>("/stats", sampleStats, { cache: "no-store" });
}

export async function getIssues() {
  const issues = await fetchFromApi<IssueSummary[]>("/issues", sampleIssues);
  return issues.map(enrichIssueSummary);
}

export async function getQueue(limit = 8) {
  return fetchFromApi<QueueJob[]>(
    `/queue?limit=${limit}`,
    sampleQueue.slice(0, limit),
    { cache: "no-store" },
  );
}

export async function getRecentSearches(limit = 4) {
  const fallback = samplePlugins.slice(0, limit).map((plugin, index) => ({
    ...plugin,
    searchedAt: new Date(Date.now() - index * 60_000).toISOString(),
    searchCount: 1,
  }));

  return fetchFromApi<PluginSearchSummary[]>(
    `/searches/recent?limit=${limit}`,
    fallback,
  );
}

export async function getAuthors(limit = 100) {
  return fetchFromApi<AuthorSummary[]>(
    `/authors?limit=${limit}`,
    sampleAuthors(limit),
  );
}

export async function getAuthor(authorName: string) {
  const fallback = sampleAuthor(authorName);

  return fetchFromApi<AuthorDetail | null>(
    `/authors/${encodeURIComponent(authorName)}`,
    fallback,
  );
}

export async function getHealth(): Promise<HealthStatus> {
  const fallback: HealthStatus = {
    ok: false,
    apiUrl: apiBaseUrl,
  };

  const health = await fetchFromApi<Omit<HealthStatus, "apiUrl">>(
    "/health",
    fallback,
    { cache: "no-store" },
  );

  return {
    ...health,
    apiUrl: apiBaseUrl,
  };
}

export async function getIssue(code: string) {
  const issue = await fetchFromApi<IssueSummary | null>(
    `/issues/${encodeURIComponent(code)}`,
    findSampleIssue(code) ?? null,
  );

  return issue ? enrichIssueSummary(issue) : null;
}

async function fetchFromApi<T>(
  path: string,
  fallback: T,
  options: { cache?: RequestCache; revalidate?: number } = {},
): Promise<T> {
  if (!apiBaseUrl) {
    return fallback;
  }

  try {
    const fetchOptions = options.cache
      ? { cache: options.cache }
      : { next: { revalidate: options.revalidate ?? DEFAULT_API_REVALIDATE_SECONDS } };
    const response = await fetch(new URL(path, apiBaseUrl), {
      ...fetchOptions,
    });

    if (response.status === 404) {
      return fallback;
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Falling back to sample PluginScore data for ${path}:`, error);
    return fallback;
  }
}

function sortSamplePlugins(plugins: PluginDetail[], sort: PluginSort, query?: string) {
  const normalizedQuery = normalizeSearchText(query ?? "");

  return [...plugins].sort((a, b) => {
    if (sort === "relevance_desc" && normalizedQuery) {
      return pluginRelevanceRank(a, normalizedQuery) - pluginRelevanceRank(b, normalizedQuery) || comparePluginPopularity(a, b);
    }
    if (sort === "score_asc") return a.score - b.score;
    if (sort === "issues_desc") return b.findings - a.findings;
    if (sort === "installs_desc") return parseCompact(b.activeInstalls) - parseCompact(a.activeInstalls);
    if (sort === "downloads_desc") return parseCompact(b.downloads) - parseCompact(a.downloads);
    if (sort === "updated_desc") return b.lastUpdated.localeCompare(a.lastUpdated);
    if (sort === "delta_desc") return (b.score - b.previousScore) - (a.score - a.previousScore);
    if (sort === "scanned_desc") return auditCompletedAt(b).localeCompare(auditCompletedAt(a));
    return b.score - a.score;
  });
}

function buildPluginsFallback({
  sort,
  query,
  audited,
  tag,
  author,
  issueCode,
  issueFamily,
}: Required<Pick<PluginsPageOptions, "sort">> & Omit<PluginsPageOptions, "page" | "perPage" | "sort">) {
  const normalizedQuery = normalizeSearchText(query ?? "");
  const normalizedAuthor = author?.trim().toLowerCase();
  const normalizedIssueFamily = issueFamily?.trim().toLowerCase();
  const normalizedIssueCode = issueCode?.trim();

  return sortSamplePlugins(
    samplePlugins
      .filter((plugin) => !normalizedQuery || pluginMatches(plugin, normalizedQuery))
      .filter((plugin) => !audited || plugin.latestAudit?.status === "complete")
      .filter((plugin) => !tag || plugin.tags?.some((pluginTag) => pluginTag.slug === tag))
      .filter((plugin) => !normalizedAuthor || plugin.author?.toLowerCase() === normalizedAuthor)
      .filter((plugin) => !normalizedIssueCode || plugin.findings > 0)
      .filter((plugin) => !normalizedIssueFamily || plugin.findings > 0),
    sort,
    query,
  );
}

function paginateFallback<T>(items: T[], page: number, perPage: number): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextCursor: page < totalPages ? `page:${page + 1}` : undefined,
  };
}

function sampleTags(limit: number, minimumPlugins: number): TagSummary[] {
  return buildSampleTagSummaries()
    .filter((tag) => tag.pluginCount >= minimumPlugins)
    .sort((a, b) => b.pluginCount - a.pluginCount || b.activeInstalls - a.activeInstalls || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function sampleTag(tagSlug: string, sort: TagSort, limit: number): TagDetail | null {
  const normalized = tagSlug.trim().toLowerCase();
  const summary = buildSampleTagSummaries().find((tag) => tag.slug === normalized);

  if (!summary) {
    return null;
  }

  const auditedOnly = sort === "score_desc" || sort === "scanned_desc" || sort === "issues_desc";
  const tagPlugins = samplePlugins
    .filter((plugin) => plugin.tags?.some((tag) => tag.slug === normalized))
    .filter((plugin) => !auditedOnly || plugin.latestAudit?.status === "complete");

  return {
    ...summary,
    plugins: sortSamplePlugins(tagPlugins, sort).slice(0, limit),
  };
}

function buildSampleTagSummaries(): TagSummary[] {
  const byTag = new Map<string, { slug: string; name: string; plugins: PluginDetail[] }>();

  for (const plugin of samplePlugins) {
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
      activeInstalls: tag.plugins.reduce((sum, plugin) => sum + parseCompact(plugin.activeInstalls), 0),
      averageScore,
    };
  });
}

function auditCompletedAt(plugin: PluginDetail) {
  return plugin.latestAudit?.completedAt ?? "";
}

function samplePluginScoreHistory(slug: string): PluginScoreHistory | null {
  const plugin = findSamplePlugin(slug);

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

function sampleAuthors(limit: number): AuthorSummary[] {
  const byAuthor = new Map<string, PluginDetail[]>();

  for (const plugin of samplePlugins) {
    if (!plugin.author) {
      continue;
    }

    const existing = byAuthor.get(plugin.author) ?? [];
    existing.push(plugin);
    byAuthor.set(plugin.author, existing);
  }

  return [...byAuthor.entries()]
    .map(([name, plugins]) => pluginsToAuthorDetail(name, plugins))
    .sort((a, b) => b.pluginCount - a.pluginCount || b.activeInstalls - a.activeInstalls || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(authorDetailToSummary);
}

function authorDetailToSummary(author: AuthorDetail): AuthorSummary {
  return {
    name: author.name,
    pluginCount: author.pluginCount,
    auditedPluginCount: author.auditedPluginCount,
    activeInstalls: author.activeInstalls,
    downloads: author.downloads,
    averageScore: author.averageScore,
    totalFindings: author.totalFindings,
    totalErrors: author.totalErrors,
    totalWarnings: author.totalWarnings,
  };
}

function sampleAuthor(authorName: string): AuthorDetail | null {
  const normalized = authorName.trim().toLowerCase();
  const plugins = samplePlugins
    .filter((plugin) => plugin.author?.toLowerCase() === normalized)
    .sort((a, b) => parseCompact(b.activeInstalls) - parseCompact(a.activeInstalls) || a.name.localeCompare(b.name));

  return plugins.length ? pluginsToAuthorDetail(plugins[0]?.author ?? authorName, plugins) : null;
}

function pluginsToAuthorDetail(name: string, plugins: PluginDetail[]): AuthorDetail {
  const audited = plugins.filter((plugin) => plugin.latestAudit?.status === "complete");
  const averageScore = audited.length
    ? Math.round(audited.reduce((sum, plugin) => sum + plugin.score, 0) / audited.length)
    : undefined;

  return {
    name,
    pluginCount: plugins.length,
    auditedPluginCount: audited.length,
    activeInstalls: plugins.reduce((sum, plugin) => sum + parseCompact(plugin.activeInstalls), 0),
    downloads: plugins.reduce((sum, plugin) => sum + parseCompact(plugin.downloads), 0),
    averageScore,
    totalFindings: plugins.reduce((sum, plugin) => sum + plugin.findings, 0),
    totalErrors: plugins.reduce((sum, plugin) => sum + plugin.errors, 0),
    totalWarnings: plugins.reduce((sum, plugin) => sum + plugin.warnings, 0),
    plugins,
  };
}

function parseCompact(value: string) {
  const normalized = value.toLowerCase().replace("+", "");
  const parsed = Number.parseFloat(normalized);

  if (normalized.endsWith("m")) return parsed * 1_000_000;
  if (normalized.endsWith("k")) return parsed * 1_000;

  return parsed;
}

function pluginMatches(plugin: PluginSummary, query: string) {
  return searchablePluginValues(plugin).some((value) => value.includes(query));
}

function pluginRelevanceRank(plugin: PluginSummary, query: string) {
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

function comparePluginPopularity(a: PluginSummary, b: PluginSummary) {
  return (
    parseCompact(b.activeInstalls) - parseCompact(a.activeInstalls) ||
    parseCompact(b.downloads) - parseCompact(a.downloads) ||
    (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    b.lastUpdated.localeCompare(a.lastUpdated) ||
    b.score - a.score ||
    a.slug.localeCompare(b.slug)
  );
}

function searchablePluginValues(plugin: PluginSummary) {
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
