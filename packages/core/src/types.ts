export type ScoreBand = "excellent" | "good" | "watch" | "risk";

export type PluginSummary = {
  slug: string;
  name: string;
  shortDescription?: string;
  iconUrl?: string;
  bannerUrl?: string;
  author?: string;
  authorUrl?: string;
  homepageUrl?: string;
  requiresWp?: string;
  testedWp?: string;
  requiresPhp?: string;
  rating?: number;
  ratingCount?: number;
  supportThreads?: number;
  supportThreadsResolved?: number;
  version: string;
  score: number;
  previousScore: number;
  activeInstalls: string;
  downloads: string;
  lastUpdated: string;
  addedAt?: string;
  scannedAt?: string;
  findings: number;
  errors: number;
  warnings: number;
  topIssue: string;
  band: ScoreBand;
  audited?: boolean;
  tags?: PluginTag[];
};

export type ScoreBreakdown = {
  security: number;
  repo: number;
  performance: number;
  maintainability: number;
};

export type PluginScoreHistoryPoint = {
  auditRunId: number;
  scannedAt: string;
  pluginVersion: string;
  pluginCheckVersion: string;
  scoringModelVersion: string;
  score: number;
  scores: ScoreBreakdown;
  findings: number;
  errors: number;
  warnings: number;
  durationMs?: number;
};

export type PluginScoreHistory = {
  slug: string;
  history: PluginScoreHistoryPoint[];
};

export type AuditRunSummary = {
  id: number;
  status: "queued" | "running" | "complete" | "failed" | "timeout";
  pluginVersion: string;
  pluginCheckVersion: string;
  scoringModelVersion: string;
  durationMs?: number;
  exitCode?: number;
  timedOut: boolean;
  sourceSha256?: string;
  rawReportObjectKey?: string;
  rawReportStored?: boolean;
  completedAt?: string;
  stderrPreview?: string;
};

export type FindingCodeCount = {
  code: string;
  title: string;
  family: string;
  severity: "error" | "warning";
  count: number;
  sampleMessage: string;
  docsUrl?: string;
};

export type PluginTag = {
  slug: string;
  name: string;
};

export type RankValue = {
  rank: number;
  total: number;
};

export type PluginTagRanking = PluginTag & {
  scoreRank?: RankValue;
  popularityRank?: RankValue;
};

export type PluginRankings = {
  overallScore?: RankValue;
  popularity?: RankValue;
  tags: PluginTagRanking[];
};

export type ExternalConnectionAnalysisMode = "off" | "new_scans" | "sample";

export type ExternalConnectionAnalysisStatus = "complete" | "skipped" | "failed" | "timeout";

export type ExternalConnectionConfidence = "high" | "medium" | "low";

export type ExternalConnectionType =
  | "outbound_http"
  | "external_asset"
  | "incoming_endpoint";

export type ExternalConnectionFinding = {
  type: ExternalConnectionType;
  confidence: ExternalConnectionConfidence;
  source: string;
  filePath?: string;
  line?: number;
  url?: string;
  domain?: string;
  endpoint?: string;
  method?: string;
};

export type ExternalConnectionDomainSummary = {
  domain: string;
  types: ExternalConnectionType[];
  confidence: ExternalConnectionConfidence;
  count: number;
  sampleUrls: string[];
};

export type ExternalConnectionEndpointSummary = {
  endpoint: string;
  source: string;
  exposure: "public" | "authenticated" | "unknown";
  count: number;
  sampleFiles: string[];
};

export type ExternalConnectionAnalysisSummary = {
  status: ExternalConnectionAnalysisStatus;
  analysisVersion: string;
  pluginVersion: string;
  analyzedAt: string;
  durationMs?: number;
  errorMessage?: string;
  filesScanned: number;
  bytesScanned: number;
  totals: {
    domains: number;
    outboundCalls: number;
    externalAssets: number;
    incomingEndpoints: number;
    findings: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  domains: ExternalConnectionDomainSummary[];
  endpoints: ExternalConnectionEndpointSummary[];
  findings: ExternalConnectionFinding[];
};

export type ExternalDomainSummary = {
  domain: string;
  pluginCount: number;
  totalReferences: number;
  outboundReferences: number;
  externalAssetReferences: number;
  lastSeenAt?: string;
  confidence: ExternalConnectionConfidence;
  platformReference: boolean;
};

export type ExternalDomainPluginSummary = {
  plugin: PluginSummary;
  pluginVersion: string;
  analyzedAt: string;
  referenceCount: number;
  referenceTypes: ExternalConnectionType[];
  outboundReferences: number;
  externalAssetReferences: number;
  sampleUrls: string[];
};

export type ExternalDomainDetail = ExternalDomainSummary & {
  plugins: ExternalDomainPluginSummary[];
};

export type PluginDetail = PluginSummary & {
  scores?: ScoreBreakdown;
  rankings?: PluginRankings;
  latestAudit?: AuditRunSummary;
  topFindings?: FindingCodeCount[];
  externalConnections?: ExternalConnectionAnalysisSummary;
};

export type PluginSearchSummary = PluginSummary & {
  searchedAt: string;
  searchCount: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
};

export type AuthorSummary = {
  name: string;
  pluginCount: number;
  auditedPluginCount: number;
  activeInstalls: number;
  downloads: number;
  averageScore?: number;
  totalFindings: number;
  totalErrors: number;
  totalWarnings: number;
};

export type AuthorDetail = AuthorSummary & {
  plugins: PluginSummary[];
};

export type TagSummary = PluginTag & {
  pluginCount: number;
  auditedPluginCount: number;
  activeInstalls: number;
  averageScore?: number;
};

export type TagDetail = TagSummary & {
  plugins: PluginSummary[];
};

export type ApiStats = {
  indexedPlugins: number;
  auditedPlugins?: number;
  completedScans: number;
  queuedJobs: number;
  runningJobs: number;
  failedJobs: number;
  issueCodes: number;
  recentSearches: number;
};

export type AuditFindingsRetentionSummary = {
  policy: "latest_scan_findings_per_plugin";
  dryRun: true;
  totalFindingRows: number;
  currentFindingRows: number;
  staleFindingRows: number;
  currentAuditRuns: number;
  staleAuditRuns: number;
  pluginsWithStaleFindings: number;
  auditFindingsTableBytes: number;
  estimatedReusableBytes: number;
};

export type OperationsVersionCount = {
  version: string;
  count: number;
};

export type OperationsRunningJob = {
  plugin: string;
  name: string;
  version: string;
  reason: string;
  attempts: number;
  runtimeMs: number;
  updatedAt: string;
};

export type OperationsRecentScan = {
  plugin: string;
  name: string;
  version: string;
  completedAt: string;
  durationMs?: number;
  score?: number;
  findings?: number;
};

export type OperationsRecentFailure = {
  plugin: string;
  name: string;
  version: string;
  state: "failed" | "timeout";
  attempts?: number;
  lastError?: string;
  updatedAt?: string;
  completedAt?: string;
  durationMs?: number;
};

export type OperationsUserSubmission = {
  plugin: string;
  name: string;
  version: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  submittedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
  score?: number;
  findings?: number;
  lastError?: string;
};

export type OperationsSummary = {
  generatedAt: string;
  coverage: {
    indexedPlugins: number;
    auditedPlugins: number;
    unscannedPlugins: number;
    completedScans: number;
    coveragePercent: number;
    queuedJobs: number;
    runningJobs: number;
    failedJobs: number;
    userSubmittedQueuedJobs: number;
  };
  queue: {
    queuedReadyJobs: number;
    queuedDelayedJobs: number;
    staleRunningJobs: number;
    oldestQueuedAt?: string;
    lastCompletedAt?: string;
    lastFailedAt?: string;
    completedScans24h: number;
    completedScansPerHour24h: number;
    averageDurationMs?: number;
    p95DurationMs?: number;
    estimatedDrainHours?: number;
    running: OperationsRunningJob[];
  };
  storage: {
    databaseBytes: number;
    auditFindingsBytes: number;
    auditRunsBytes: number;
    scoreSnapshotsBytes: number;
    scanJobsBytes: number;
    rawReportJsonBytes: number;
    stderrBytes: number;
    totalFindingRows: number;
    averageFindingsPerStoredAudit?: number;
    p50FindingsPerStoredAudit?: number;
    p90FindingsPerStoredAudit?: number;
    p99FindingsPerStoredAudit?: number;
    maxFindingsPerStoredAudit?: number;
  };
  versions: {
    apiPluginCheckVersion: string;
    scoringModelVersion: string;
    pluginCheckVersions: OperationsVersionCount[];
    scoringModelVersions: OperationsVersionCount[];
  };
  retryPolicy: {
    runningJobTimeoutSeconds: number;
    runningJobMaxAttempts: number;
    scanRetryBackoffSeconds: number;
    scanTerminalTimeoutAttempts: number;
  };
  failures: {
    failedAuditRuns: number;
    timeoutAuditRuns: number;
    repeatedTimeoutPlugins: number;
    recent: OperationsRecentFailure[];
  };
  userSubmissions: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    lastSubmittedAt?: string;
    recent: OperationsUserSubmission[];
  };
  recentCompleted: OperationsRecentScan[];
};

export type ExternalConnectionSettings = {
  mode: ExternalConnectionAnalysisMode;
  sampleRemaining: number;
  updatedAt?: string;
  envDisabled?: boolean;
};

export type ExternalConnectionOperations = {
  settings: ExternalConnectionSettings;
  stats: {
    analyzedPlugins: number;
    complete: number;
    failed: number;
    skipped: number;
    timeout: number;
    domainsDetected: number;
    incomingEndpointsDetected: number;
    averageDurationMs?: number;
    lastAnalyzedAt?: string;
  };
  recent: Array<{
    plugin: string;
    name: string;
    version: string;
    status: ExternalConnectionAnalysisStatus;
    analyzedAt: string;
    durationMs?: number;
    domains: number;
    incomingEndpoints: number;
    errorMessage?: string;
  }>;
};

export type TrackedPluginSummary = {
  slug: string;
  version?: string;
  updatedAt?: string;
};

export type PluginSubmissionResult = {
  slug: string;
  name: string;
  version: string;
  queued: boolean;
  jobId: number;
  pluginUrl: string;
};

export type PluginReportType =
  | "incorrect_metadata"
  | "score_looks_wrong"
  | "false_positive_issue"
  | "missing_issue"
  | "plugin_updated"
  | "other";

export type PluginReportStatus = "new" | "triaged" | "resolved" | "spam";

export type PluginReportInput = {
  pluginSlug: string;
  pluginVersion?: string;
  auditRunId?: number;
  reportType: PluginReportType;
  message: string;
  contactEmail?: string;
  ipHash?: string;
  userAgent?: string;
};

export type PluginReportUpdateInput = {
  status?: PluginReportStatus;
  adminNotes?: string;
};

export type PluginReport = {
  id: number;
  pluginSlug: string;
  pluginName?: string;
  pluginVersion: string;
  auditRunId?: number;
  reportType: PluginReportType;
  message: string;
  contactEmail?: string;
  status: PluginReportStatus;
  adminNotes?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

export type PluginReportStats = {
  total: number;
  new: number;
  triaged: number;
  resolved: number;
  spam: number;
};

export type IssueReference = {
  label: string;
  href: string;
};

export type IssueEditorial = {
  title?: string;
  summary: string;
  whyItShowsUp: string;
  whyItMatters: string;
  fixSummary: string;
  howToFix: string[];
  notes?: string[];
  references?: IssueReference[];
};

export type IssueSummary = {
  code: string;
  title: string;
  family: string;
  weight: "critical" | "high" | "medium" | "low";
  affectedPlugins: number;
  explanation: string;
  fix: string;
  summary?: string;
  whyItShowsUp?: string;
  whyItMatters?: string;
  howToFix?: string[];
  notes?: string[];
  references?: IssueReference[];
};

export type QueueJob = {
  plugin: string;
  version: string;
  state: "queued" | "running" | "failed" | "complete";
  reason: string;
  runtime: string;
};

export type WordPressPluginMetadata = {
  slug: string;
  name: string;
  shortDescription?: string;
  iconUrl?: string;
  bannerUrl?: string;
  author?: string;
  authorUrl?: string;
  homepageUrl?: string;
  requiresWp?: string;
  testedWp?: string;
  requiresPhp?: string;
  rating?: number;
  ratingCount?: number;
  supportThreads?: number;
  supportThreadsResolved?: number;
  version: string;
  activeInstalls?: number;
  downloaded?: number;
  lastUpdated?: string;
  addedAt?: string;
  downloadLink: string;
  tags?: PluginTag[];
};

export type ScanJobDto = {
  id: number;
  pluginId: number;
  slug: string;
  name: string;
  targetVersion: string;
  reason: string;
  downloadUrl: string;
  attempts: number;
  externalConnectionAnalysis?: {
    enabled: boolean;
    mode: ExternalConnectionAnalysisMode;
  };
};

export type NormalizedFinding = {
  code: string;
  type: string;
  severity: "error" | "warning";
  filePath?: string;
  line?: number;
  column?: number;
  message: string;
  docsUrl?: string;
};

export type ScanCompletePayload = {
  pluginVersion: string;
  pluginCheckVersion: string;
  scoringModelVersion: string;
  sourceDownloadUrl: string;
  sourceSha256?: string;
  durationMs: number;
  exitCode: number;
  rawReportObjectKey?: string;
  rawReport?: unknown;
  stderr?: string;
  findings: NormalizedFinding[];
  externalConnections?: ExternalConnectionAnalysisSummary;
};

export type ScanFailPayload = {
  message: string;
  pluginCheckVersion?: string;
  scoringModelVersion?: string;
  timedOut?: boolean;
  stderr?: string;
  durationMs?: number;
};
