import type {
  ApiStats,
  AuditFindingsRetentionSummary,
  AuthorDetail,
  AuthorSummary,
  ExternalConnectionAnalysisMode,
  ExternalDomainDetail,
  ExternalDomainSummary,
  ExternalConnectionOperations,
  IssueSummary,
  OperationsSummary,
  PaginatedResult,
  PluginDetail,
  PluginReport,
  PluginReportInput,
  PluginReportStats,
  PluginReportStatus,
  PluginReportType,
  PluginReportUpdateInput,
  PluginSearchSummary,
  PluginScoreHistory,
  PluginSummary,
  QueueJob,
  ScanCompletePayload,
  ScanFailPayload,
  ScanJobDto,
  TagDetail,
  TagSummary,
  TrackedPluginSummary,
  WordPressPluginMetadata,
} from "@pluginscore/core";

export type ListPluginsOptions = {
  page: number;
  perPage: number;
  sort:
    | "score_desc"
    | "score_asc"
    | "downloads_desc"
    | "installs_desc"
    | "updated_desc"
    | "scanned_desc"
    | "issues_desc"
    | "delta_desc"
    | "new_popular_desc"
    | "relevance_desc";
  query?: string;
  auditedOnly?: boolean;
  tag?: string;
  author?: string;
  issueCode?: string;
  issueFamily?: string;
};

export type ListQueueOptions = {
  limit: number;
};

export type ListTrackedPluginsOptions = {
  limit: number;
};

export type GetPluginHistoryOptions = {
  limit: number;
};

export type ListRecentSearchesOptions = {
  limit: number;
};

export type ListPluginReportsOptions = {
  page: number;
  perPage: number;
  status?: PluginReportStatus;
  reportType?: PluginReportType;
  pluginSlug?: string;
  hasContactEmail?: boolean;
  createdFrom?: string;
  createdTo?: string;
};

export type ListAuthorsOptions = {
  limit: number;
  sort:
    | "installs_desc"
    | "downloads_desc"
    | "score_desc"
    | "score_asc"
    | "new_popular_desc"
    | "issues_desc"
    | "scanned_desc";
};

export type ListTagsOptions = {
  limit: number;
  minimumPlugins?: number;
};

export type ListExternalDomainsOptions = {
  limit: number;
  minimumPlugins?: number;
};

export type GetExternalDomainOptions = {
  limit: number;
};

export type GetTagOptions = {
  limit: number;
  sort:
    | "score_desc"
    | "score_asc"
    | "installs_desc"
    | "downloads_desc"
    | "new_popular_desc"
    | "issues_desc"
    | "delta_desc"
    | "scanned_desc";
};

export type EnqueueJobInput = WordPressPluginMetadata & {
  reason: string;
  priority?: number;
  pluginCheckVersion?: string;
  scoringModelVersion?: string;
  force?: boolean;
};

export type ExternalConnectionSettingsInput = {
  mode: ExternalConnectionAnalysisMode;
  sampleRemaining?: number;
};

export interface PluginScoreStore {
  health(): Promise<{ ok: true; mode: "memory" | "postgres" }>;
  stats(): Promise<ApiStats>;
  auditFindingsRetention(): Promise<AuditFindingsRetentionSummary>;
  operationsSummary(): Promise<OperationsSummary>;
  externalConnectionOperations(): Promise<ExternalConnectionOperations>;
  updateExternalConnectionSettings(input: ExternalConnectionSettingsInput): Promise<ExternalConnectionOperations>;
  listPlugins(options: ListPluginsOptions): Promise<PaginatedResult<PluginSummary>>;
  getPlugin(slug: string): Promise<PluginDetail | null>;
  getPluginHistory(slug: string, options: GetPluginHistoryOptions): Promise<PluginScoreHistory | null>;
  recordSearch(slug: string): Promise<{ recorded: boolean }>;
  listRecentSearches(options: ListRecentSearchesOptions): Promise<PluginSearchSummary[]>;
  createPluginReport(input: PluginReportInput): Promise<PluginReport | null>;
  listPluginReports(options: ListPluginReportsOptions): Promise<PaginatedResult<PluginReport>>;
  pluginReportStats(): Promise<PluginReportStats>;
  updatePluginReport(id: number, input: PluginReportUpdateInput): Promise<PluginReport | null>;
  listAuthors(options: ListAuthorsOptions): Promise<AuthorSummary[]>;
  getAuthor(authorName: string): Promise<AuthorDetail | null>;
  listTags(options: ListTagsOptions): Promise<TagSummary[]>;
  getTag(tagSlug: string, options: GetTagOptions): Promise<TagDetail | null>;
  listExternalDomains(options: ListExternalDomainsOptions): Promise<ExternalDomainSummary[]>;
  getExternalDomain(domain: string, options: GetExternalDomainOptions): Promise<ExternalDomainDetail | null>;
  listTrackedPlugins(options: ListTrackedPluginsOptions): Promise<TrackedPluginSummary[]>;
  listQueue(options: ListQueueOptions): Promise<QueueJob[]>;
  listIssues(): Promise<IssueSummary[]>;
  getIssue(code: string): Promise<IssueSummary | null>;
  enqueueJob(input: EnqueueJobInput): Promise<{ id: number; queued: boolean }>;
  claimNextJob(): Promise<ScanJobDto | null>;
  completeJob(id: number, payload: ScanCompletePayload): Promise<void>;
  failJob(id: number, payload: ScanFailPayload): Promise<void>;
  close(): Promise<void>;
}
