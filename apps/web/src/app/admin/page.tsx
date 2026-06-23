import {
  Activity,
  AlertTriangle,
  Clock3,
  Database,
  Globe2,
  Gauge,
  HardDrive,
  History,
  MessageSquareWarning,
  RotateCcw,
  Timer,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  getAuditFindingsRetention,
  getExternalConnectionOperations,
  getFreshStats,
  getHealth,
  getOperationsSummary,
  getPluginReportStats,
  getQueue,
} from "@/lib/api";

export const metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type AdminView = "overview" | "queue" | "submissions" | "external" | "system";

const adminViews: Array<{ id: AdminView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Queue" },
  { id: "submissions", label: "Submissions" },
  { id: "external", label: "External Connections" },
  { id: "system", label: "System" },
];

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { view } = await searchParams;
  const activeView = parseAdminView(view);
  const [health, stats, queueJobs, retention, operations, reportStats, externalConnections] = await Promise.all([
    getHealth(),
    getFreshStats(),
    getQueue(20),
    getAuditFindingsRetention(),
    getOperationsSummary(),
    getPluginReportStats(),
    getExternalConnectionOperations(),
  ]);
  const metrics = [
    { label: "Indexed plugins", value: stats.indexedPlugins.toLocaleString(), detail: "metadata rows" },
    { label: "Audited plugins", value: (stats.auditedPlugins ?? stats.completedScans).toLocaleString(), detail: "unique plugins" },
    { label: "Completed audits", value: stats.completedScans.toLocaleString(), detail: "stored scan history" },
    { label: "Queued jobs", value: stats.queuedJobs.toLocaleString(), detail: "waiting to scan" },
    { label: "Running scans", value: stats.runningJobs.toLocaleString(), detail: "active workers" },
    { label: "Failed jobs", value: stats.failedJobs.toLocaleString(), detail: "needs operator check" },
    { label: "Open issue codes", value: stats.issueCodes.toLocaleString(), detail: "deduped taxonomy" },
  ];
  const operationsMetrics = operations
    ? [
        {
          label: "Audit coverage",
          value: `${operations.coverage.coveragePercent.toLocaleString()}%`,
          detail: `${operations.coverage.auditedPlugins.toLocaleString()} of ${operations.coverage.indexedPlugins.toLocaleString()} plugins`,
        },
        {
          label: "Unscanned plugins",
          value: operations.coverage.unscannedPlugins.toLocaleString(),
          detail: "indexed without completed audit",
        },
        {
          label: "Completed 24h",
          value: operations.queue.completedScans24h.toLocaleString(),
          detail: `${operations.queue.completedScansPerHour24h.toLocaleString()} scans/hour`,
        },
        {
          label: "Drain estimate",
          value: formatHours(operations.queue.estimatedDrainHours),
          detail: `${operations.coverage.queuedJobs.toLocaleString()} queued jobs`,
        },
        {
          label: "Average scan",
          value: formatDuration(operations.queue.averageDurationMs),
          detail: `p95 ${formatDuration(operations.queue.p95DurationMs)}`,
        },
        {
          label: "Stale running",
          value: operations.queue.staleRunningJobs.toLocaleString(),
          detail: "past running timeout window",
        },
      ]
    : [];
  const userSubmissionMetrics = operations
    ? [
        {
          label: "Submitted",
          value: operations.userSubmissions.total.toLocaleString(),
          detail: operations.userSubmissions.lastSubmittedAt
            ? `last ${formatDateTime(operations.userSubmissions.lastSubmittedAt)}`
            : "no submissions yet",
        },
        {
          label: "Completed",
          value: operations.userSubmissions.completed.toLocaleString(),
          detail: "user-triggered scans",
        },
        {
          label: "Active",
          value: (operations.userSubmissions.queued + operations.userSubmissions.running).toLocaleString(),
          detail: `${operations.userSubmissions.queued.toLocaleString()} queued, ${operations.userSubmissions.running.toLocaleString()} running`,
        },
        {
          label: "Failed",
          value: operations.userSubmissions.failed.toLocaleString(),
          detail: `${operations.userSubmissions.cancelled.toLocaleString()} cancelled`,
        },
      ]
    : [];
  const externalConnectionMetrics = externalConnections
    ? [
        {
          label: "Mode",
          value: externalConnectionModeLabel(externalConnections.settings.mode),
          detail: externalConnections.settings.envDisabled
            ? "disabled by server env"
            : externalConnections.settings.mode === "sample"
              ? `${externalConnections.settings.sampleRemaining.toLocaleString()} sample scans left`
              : "admin controlled",
        },
        {
          label: "Analyzed",
          value: externalConnections.stats.analyzedPlugins.toLocaleString(),
          detail: `${externalConnections.stats.complete.toLocaleString()} complete, ${externalConnections.stats.failed.toLocaleString()} failed`,
        },
        {
          label: "Domains",
          value: externalConnections.stats.domainsDetected.toLocaleString(),
          detail: `${externalConnections.stats.incomingEndpointsDetected.toLocaleString()} incoming endpoints`,
        },
        {
          label: "Average time",
          value: formatDuration(externalConnections.stats.averageDurationMs),
          detail: externalConnections.stats.lastAnalyzedAt
            ? `last ${formatDateTime(externalConnections.stats.lastAnalyzedAt)}`
            : "not analyzed yet",
        },
      ]
    : [];

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-brand">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              PluginScore Operations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Private audit, queue, and backend health snapshot for the scan pipeline.
            </p>
          </div>
          <div className="rounded-md border border-line bg-background px-3 py-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-2 font-medium transition hover:text-brand"
              >
                <MessageSquareWarning size={16} aria-hidden="true" />
                Reports
                {reportStats ? (
                  <span className="font-mono text-muted">({reportStats.new.toLocaleString()} new)</span>
                ) : null}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AdminTabs activeView={activeView} />

      {activeView === "overview" ? (
        <>
          <section className="rounded-md border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand">Audit overview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                  Scan index snapshot
                </h2>
              </div>
              <Gauge size={20} className="text-muted" aria-hidden="true" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-md border border-line bg-background p-4"
                >
                  <p className="text-xs font-medium uppercase text-muted">
                    {metric.label}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-semibold">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted">{metric.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {operations ? (
            <section className="rounded-md border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-brand">Operations</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                    Pipeline visibility
                  </h2>
                </div>
                <Timer size={20} className="text-muted" aria-hidden="true" />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {operationsMetrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeView === "external" && externalConnections ? (
        <section className="rounded-md border border-line bg-surface">
          <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-background text-muted">
                <Globe2 size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-brand">Experimental</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                  External Connections
                </h2>
              </div>
            </div>
            <form
              action="/admin/external-connections"
              method="post"
              className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_8rem_auto]"
            >
              <label className="grid gap-1 text-xs font-medium uppercase text-muted">
                Mode
                <select
                  name="mode"
                  defaultValue={externalConnections.settings.mode}
                  className="h-10 rounded-md border border-line bg-background px-3 text-sm normal-case text-foreground"
                >
                  <option value="off">Off</option>
                  <option value="new_scans">New scans</option>
                  <option value="sample">Sample</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium uppercase text-muted">
                Sample
                <input
                  name="sampleRemaining"
                  type="number"
                  min="0"
                  max="1000"
                  defaultValue={externalConnections.settings.mode === "sample" ? externalConnections.settings.sampleRemaining : 25}
                  className="h-10 rounded-md border border-line bg-background px-3 text-sm normal-case text-foreground"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center self-end rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
              >
                Save
              </button>
            </form>
          </div>
          <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 xl:grid-cols-4">
            {externalConnectionMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
          {externalConnections.recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="px-5 py-3 font-semibold">Plugin</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Domains</th>
                    <th className="px-5 py-3 text-right font-semibold">Endpoints</th>
                    <th className="px-5 py-3 text-right font-semibold">Duration</th>
                    <th className="px-5 py-3 font-semibold">Analyzed</th>
                  </tr>
                </thead>
                <tbody>
                  {externalConnections.recent.map((item) => (
                    <tr key={`${item.plugin}-${item.analyzedAt}`} className="border-b border-line">
                      <td className="px-5 py-4">
                        <Link
                          href={`/plugins/${item.plugin}`}
                          className="block truncate font-medium hover:text-brand"
                        >
                          {item.name}
                        </Link>
                        <span className="mt-1 block font-mono text-xs text-muted">{item.plugin}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${connectionStatusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono">{item.domains.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right font-mono">{item.incomingEndpoints.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right font-mono">{formatDuration(item.durationMs)}</td>
                      <td className="px-5 py-4 text-muted">{formatDateTime(item.analyzedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted">
              No external connection analyses have been stored yet.
            </p>
          )}
        </section>
      ) : null}

      {activeView === "submissions" && operations ? (
        <section className="rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <p className="text-sm font-medium text-brand">Submissions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                User Submissions
              </h2>
            </div>
            <Clock3 size={18} className="text-muted" aria-hidden="true" />
          </div>
          <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 xl:grid-cols-4">
            {userSubmissionMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
          {operations.userSubmissions.recent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="px-5 py-3 font-semibold">Plugin</th>
                    <th className="px-5 py-3 font-semibold">Version</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Score</th>
                    <th className="px-5 py-3 text-right font-semibold">Findings</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 text-right font-semibold">Duration</th>
                    <th className="px-5 py-3 font-semibold">Last Error</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.userSubmissions.recent.map((submission) => (
                    <tr key={`${submission.plugin}-${submission.submittedAt}`} className="border-b border-line">
                      <td className="px-5 py-4">
                        <Link
                          href={`/plugins/${submission.plugin}`}
                          className="block truncate font-medium hover:text-brand"
                        >
                          {submission.name}
                        </Link>
                        <span className="mt-1 block font-mono text-xs text-muted">{submission.plugin}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{submission.version}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${submissionStatusClass(submission.status)}`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono">{formatOptionalNumber(submission.score)}</td>
                      <td className="px-5 py-4 text-right font-mono">{formatOptionalNumber(submission.findings)}</td>
                      <td className="px-5 py-4 text-muted">
                        <time dateTime={submission.submittedAt}>{formatDateTime(submission.submittedAt)}</time>
                      </td>
                      <td className="px-5 py-4 text-right font-mono">{formatDuration(submission.durationMs)}</td>
                      <td className="max-w-[28ch] truncate px-5 py-4 text-muted">
                        {submission.lastError ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted">No user submissions yet.</p>
          )}
        </section>
      ) : null}

      {activeView === "system" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-md border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Backend Health</h2>
              <Activity size={18} className="text-muted" aria-hidden="true" />
            </div>
            <div className="mt-4 divide-y divide-line text-sm">
              <Meta label="API URL" value={health.apiUrl ?? "sample data"} />
              <Meta label="Status" value={health.ok ? "ok" : "fallback"} />
              <Meta label="Mode" value={health.mode ?? "sample"} />
            </div>
          </section>

          <section className="rounded-md border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Maintenance</h2>
              <Wrench size={18} className="text-muted" aria-hidden="true" />
            </div>
            {retention ? (
              <div className="mt-4 divide-y divide-line text-sm">
                <Meta label="Policy" value="latest findings" />
                <Meta label="Stale findings" value={retention.staleFindingRows.toLocaleString()} />
                <Meta label="Stale audits" value={retention.staleAuditRuns.toLocaleString()} />
                <Meta label="Affected plugins" value={retention.pluginsWithStaleFindings.toLocaleString()} />
                <Meta label="Reusable DB space" value={formatBytes(retention.estimatedReusableBytes)} />
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted">
                Internal maintenance check is not configured for this deployment.
              </p>
            )}
          </section>

          {operations ? (
            <>
              <section className="rounded-md border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Retry Policy</h2>
                  <RotateCcw size={18} className="text-muted" aria-hidden="true" />
                </div>
                <div className="mt-4 divide-y divide-line text-sm">
                  <Meta label="Running timeout" value={formatDuration(operations.retryPolicy.runningJobTimeoutSeconds * 1000)} />
                  <Meta label="Max attempts" value={operations.retryPolicy.runningJobMaxAttempts.toLocaleString()} />
                  <Meta label="Retry backoff" value={formatDuration(operations.retryPolicy.scanRetryBackoffSeconds * 1000)} />
                  <Meta label="Terminal timeouts" value={operations.retryPolicy.scanTerminalTimeoutAttempts.toLocaleString()} />
                </div>
              </section>

              <section className="rounded-md border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Versions</h2>
                  <History size={18} className="text-muted" aria-hidden="true" />
                </div>
                <div className="mt-4 divide-y divide-line text-sm">
                  <Meta label="Plugin Check" value={operations.versions.apiPluginCheckVersion} />
                  <Meta label="Scoring model" value={operations.versions.scoringModelVersion} />
                  <Meta label="Completed Check" value={formatVersionCounts(operations.versions.pluginCheckVersions)} />
                  <Meta label="Completed Model" value={formatVersionCounts(operations.versions.scoringModelVersions)} />
                </div>
              </section>

              <section className="rounded-md border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Storage</h2>
                  <HardDrive size={18} className="text-muted" aria-hidden="true" />
                </div>
                <div className="mt-4 divide-y divide-line text-sm">
                  <Meta label="Database" value={formatBytes(operations.storage.databaseBytes)} />
                  <Meta label="Findings table" value={formatBytes(operations.storage.auditFindingsBytes)} />
                  <Meta label="Audit runs" value={formatBytes(operations.storage.auditRunsBytes)} />
                  <Meta label="Raw reports" value={formatBytes(operations.storage.rawReportJsonBytes)} />
                  <Meta label="Finding rows" value={operations.storage.totalFindingRows.toLocaleString()} />
                  <Meta label="p90 findings/audit" value={formatOptionalNumber(operations.storage.p90FindingsPerStoredAudit)} />
                </div>
              </section>
            </>
          ) : null}
        </section>
      ) : null}

      {activeView === "queue" ? (
        <>
          <section className="rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line p-5">
            <h2 className="text-base font-semibold">Worker Queue</h2>
            <Clock3 size={18} className="text-muted" aria-hidden="true" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-semibold">Plugin</th>
                  <th className="px-5 py-3 font-semibold">Version</th>
                  <th className="px-5 py-3 font-semibold">State</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 text-right font-semibold">Runtime</th>
                </tr>
              </thead>
              <tbody>
                {queueJobs.map((job, index) => (
                  <tr
                    key={`${job.plugin}-${job.version}-${job.state}-${job.reason}-${index}`}
                    className="border-b border-line"
                  >
                    <td className="px-5 py-4 font-mono">{job.plugin}</td>
                    <td className="px-5 py-4">{job.version}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          job.state === "failed"
                            ? "bg-risk/10 text-risk"
                            : job.state === "running"
                              ? "bg-info/10 text-info"
                              : "bg-surface-subtle text-muted"
                        }`}
                      >
                        {job.state}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">{job.reason}</td>
                    <td className="px-5 py-4 text-right font-mono">{job.runtime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>

          {operations ? (
            <section className="grid gap-4">
          <section className="rounded-md border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-base font-semibold">Recent Completed Scans</h2>
              <Clock3 size={18} className="text-muted" aria-hidden="true" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-muted">
                    <th className="px-5 py-3 font-semibold">Plugin</th>
                    <th className="px-5 py-3 font-semibold">Version</th>
                    <th className="px-5 py-3 text-right font-semibold">Score</th>
                    <th className="px-5 py-3 text-right font-semibold">Findings</th>
                    <th className="px-5 py-3 text-right font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.recentCompleted.map((scan) => (
                    <tr key={`${scan.plugin}-${scan.completedAt}`} className="border-b border-line">
                      <td className="px-5 py-4">
                        <span className="block truncate font-medium">{scan.name}</span>
                        <span className="mt-1 block font-mono text-xs text-muted">{scan.plugin}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{scan.version}</td>
                      <td className="px-5 py-4 text-right font-mono">{formatOptionalNumber(scan.score)}</td>
                      <td className="px-5 py-4 text-right font-mono">{formatOptionalNumber(scan.findings)}</td>
                      <td className="px-5 py-4 text-right font-mono">{formatDuration(scan.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-base font-semibold">Recent Failures</h2>
              <AlertTriangle size={18} className="text-muted" aria-hidden="true" />
            </div>
            {operations.failures.recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase text-muted">
                      <th className="px-5 py-3 font-semibold">Plugin</th>
                      <th className="px-5 py-3 font-semibold">State</th>
                      <th className="px-5 py-3 font-semibold">Attempts</th>
                      <th className="px-5 py-3 font-semibold">Last Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.failures.recent.map((failure) => (
                      <tr key={`${failure.plugin}-${failure.state}-${failure.updatedAt ?? failure.completedAt}`} className="border-b border-line">
                        <td className="px-5 py-4">
                          <span className="block truncate font-medium">{failure.name}</span>
                          <span className="mt-1 block font-mono text-xs text-muted">{failure.plugin}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-risk/10 px-2 py-1 text-xs font-semibold text-risk">
                            {failure.state}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono">{formatOptionalNumber(failure.attempts)}</td>
                        <td className="max-w-[32ch] truncate px-5 py-4 text-muted">
                          {failure.lastError ?? "No error text"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted">No recent failures.</p>
            )}
          </section>
            </section>
          ) : null}
        </>
      ) : null}

    </AppShell>
  );
}

function AdminTabs({ activeView }: { activeView: AdminView }) {
  return (
    <nav
      aria-label="Admin sections"
      className="rounded-md border border-line bg-surface p-2"
    >
      <div className="flex flex-wrap gap-2">
        {adminViews.map((view) => {
          const isActive = view.id === activeView;

          return (
            <Link
              key={view.id}
              href={view.id === "overview" ? "/admin" : `/admin?view=${view.id}`}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition ${
                isActive
                  ? "border-brand/40 bg-brand/10 text-foreground"
                  : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-line bg-background p-4">
      <p className="text-xs font-medium uppercase text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-muted">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-2 text-right font-medium">
        <Database size={14} className="text-muted" aria-hidden="true" />
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}

function parseAdminView(value?: string): AdminView {
  return adminViews.some((view) => view.id === value) ? (value as AdminView) : "overview";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(ms?: number) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) {
    return "n/a";
  }

  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatHours(hours?: number) {
  if (!hours || !Number.isFinite(hours) || hours <= 0) {
    return "n/a";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  return `${hours.toLocaleString()}h`;
}

function formatOptionalNumber(value?: number) {
  return value === undefined ? "n/a" : value.toLocaleString();
}

function formatDateTime(value?: string) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatVersionCounts(versions: Array<{ version: string; count: number }>) {
  const [first] = versions;
  return first ? `${first.version} (${first.count.toLocaleString()})` : "n/a";
}

function externalConnectionModeLabel(mode: string) {
  if (mode === "new_scans") {
    return "New scans";
  }

  if (mode === "sample") {
    return "Sample";
  }

  return "Off";
}

function connectionStatusClass(status: string) {
  if (status === "failed" || status === "timeout") {
    return "bg-risk/10 text-risk";
  }

  if (status === "complete") {
    return "bg-good/10 text-good";
  }

  return "bg-surface-subtle text-muted";
}

function submissionStatusClass(status: string) {
  if (status === "failed" || status === "cancelled") {
    return "bg-risk/10 text-risk";
  }

  if (status === "running") {
    return "bg-info/10 text-info";
  }

  if (status === "complete") {
    return "bg-good/10 text-good";
  }

  return "bg-surface-subtle text-muted";
}
