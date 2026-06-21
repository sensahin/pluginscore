import type { FindingCodeCount, PluginDetail, PluginScoreHistoryPoint } from "@pluginscore/core";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  Package,
  Star,
  User,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PluginIcon } from "@/components/plugin-icon";
import { RelativeDate } from "@/components/relative-date";
import { PluginSubmissionAction } from "@/components/plugin-submission-action";
import { RelatedPluginTabs, type RelatedPluginTab } from "@/components/related-plugin-tabs";
import { TagChips } from "@/components/tag-chips";
import { getAuthor, getPlugins } from "@/lib/api";
import { groupFindingCodeCounts } from "@/lib/finding-groups";
import { formatExactDate, formatShortDate, formatSlugTitle } from "@/lib/formatting";
import {
  sortPluginSummaries,
  uniquePluginsBySlug,
  withoutPlugin,
} from "@/lib/plugin-list-utils";
import { formatPluginDirectoryAge } from "@/lib/plugin-age";
import { scoreDelta } from "@/lib/plugin-score-data";

export async function PluginPageView({
  plugin,
  history,
}: {
  plugin: PluginDetail;
  history: PluginScoreHistoryPoint[];
}) {
  const relatedTabs = await getRelatedPluginTabs(plugin);
  const supportRate =
    plugin.supportThreads && plugin.supportThreadsResolved !== undefined
      ? Math.round((plugin.supportThreadsResolved / plugin.supportThreads) * 100)
      : undefined;

  return (
    <AppShell>
      <PluginSummaryHeader plugin={plugin} supportRate={supportRate} />
      {plugin.audited === false ? <PendingAuditPanel plugin={plugin} /> : null}

      <div className="space-y-6">
        <TopIssuesByCategory findings={plugin.topFindings ?? []} />
        <IssuesDetails plugin={plugin} />

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="rounded-md border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold">Latest Snapshot</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SmallStat
                  label="Findings"
                  value={plugin.audited === false ? "Pending" : plugin.findings.toLocaleString()}
                />
                <SmallStat
                  label="Errors"
                  value={plugin.audited === false ? "Pending" : plugin.errors.toLocaleString()}
                />
                <SmallStat
                  label="Warnings"
                  value={plugin.audited === false ? "Pending" : plugin.warnings.toLocaleString()}
                />
              </div>
            </div>

            <ScoreHistory history={history} plugin={plugin} />
            <RelatedPluginTabs tabs={relatedTabs} />
          </div>

          <div className="space-y-6">
            <PluginRankings plugin={plugin} />
            <PluginMetadata plugin={plugin} supportRate={supportRate} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export function MissingPluginPage({ slug }: { slug: string }) {
  return (
    <AppShell>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center rounded-md border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-surface-subtle text-muted">
          <Package size={24} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-normal">{formatSlugTitle(slug)}</h1>
        <p className="mt-2 text-sm text-muted">Not indexed yet.</p>
        <PluginSubmissionAction input={slug} className="mt-5" />
      </section>
    </AppShell>
  );
}

function PendingAuditPanel({ plugin }: { plugin: PluginDetail }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-surface-subtle text-muted">
          <Clock3 size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Scan pending</h2>
          <p className="mt-1 text-sm text-muted">
            {plugin.name} is queued for Plugin Check.
          </p>
        </div>
      </div>
    </section>
  );
}

async function getRelatedPluginTabs(plugin: PluginDetail): Promise<RelatedPluginTab[]> {
  const tagSlugs = (plugin.tags ?? []).slice(0, 4).map((tag) => tag.slug);

  const [bestTagLists, installedTagLists, authorDetail] = await Promise.all([
    Promise.all(
      tagSlugs.map((tag) =>
        getPlugins({ limit: 8, sort: "score_desc", audited: true, tag }),
      ),
    ),
    Promise.all(
      tagSlugs.map((tag) =>
        getPlugins({ limit: 8, sort: "installs_desc", tag }),
      ),
    ),
    plugin.author ? getAuthor(plugin.author) : Promise.resolve(null),
  ]);

  const bestInTags = sortPluginSummaries(
    withoutPlugin(uniquePluginsBySlug(bestTagLists.flat()), plugin.slug),
    "score_desc",
  ).slice(0, 6);
  const mostInstalledInTags = sortPluginSummaries(
    withoutPlugin(uniquePluginsBySlug(installedTagLists.flat()), plugin.slug),
    "installs_desc",
  ).slice(0, 6);
  const sameAuthor = authorDetail
    ? sortPluginSummaries(
        withoutPlugin(authorDetail.plugins, plugin.slug),
        "installs_desc",
      ).slice(0, 6)
    : [];

  return [
    { id: "best-tags", label: "Best in same tags", plugins: bestInTags },
    { id: "installed-tags", label: "Most installed", plugins: mostInstalledInTags },
    { id: "same-author", label: "Same author", plugins: sameAuthor },
  ];
}

function PluginSummaryHeader({
  plugin,
  supportRate,
}: {
  plugin: PluginDetail;
  supportRate?: number;
}) {
  const wpUrl = `https://wordpress.org/plugins/${encodeURIComponent(plugin.slug)}/`;
  const authorHref = plugin.author
    ? `/authors/${encodeURIComponent(plugin.author)}`
    : undefined;

  return (
    <section className="mb-2 mt-1">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-4 flex items-start gap-3">
            <PluginIcon plugin={plugin} size="md" />
            <div className="flex min-w-0 items-start gap-2">
              <h1 className="text-4xl font-bold tracking-normal">{plugin.name}</h1>
              <a
                href={wpUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="View on WordPress.org"
                className="mt-1 shrink-0 text-muted transition hover:text-foreground"
              >
                <ExternalLink size={20} aria-hidden="true" />
              </a>
            </div>
          </div>

          {plugin.shortDescription ? (
            <p className="mb-4 max-w-3xl text-lg leading-7 text-muted">
              {plugin.shortDescription}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <IconMeta icon={<Package size={16} />} value={`v${plugin.version}`} />
            {plugin.author ? (
              <IconMeta
                icon={<User size={16} />}
                value={plugin.author}
                href={authorHref}
              />
            ) : null}
            <IconMeta
              icon={<Calendar size={16} />}
              value={<>Updated <RelativeDate value={plugin.lastUpdated} /></>}
            />
            {plugin.addedAt ? (
              <IconMeta
                icon={<Calendar size={16} />}
                value={<>Added <RelativeDate value={plugin.addedAt} /></>}
              />
            ) : null}
            <IconMeta
              icon={<Download size={16} />}
              value={`${plugin.activeInstalls} installs`}
            />
            {plugin.rating !== undefined ? (
              <IconMeta
                icon={<Star size={16} />}
                value={`${plugin.rating}% rating`}
              />
            ) : null}
            {supportRate !== undefined ? (
              <IconMeta value={`${supportRate}% support resolved`} />
            ) : null}
          </div>

          {plugin.tags?.length ? (
            <div className="mt-4">
              <TagChips tags={plugin.tags} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:w-fit lg:flex-row">
          <ScoreCard plugin={plugin} />
          <ScoreBreakdown plugin={plugin} />
        </div>
      </div>
    </section>
  );
}

function IconMeta({
  icon,
  value,
  href,
}: {
  icon?: ReactNode;
  value: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      {icon}
      <span>{value}</span>
      {href && isExternalHref(href) ? <ExternalLink size={13} aria-hidden="true" /> : null}
    </>
  );

  if (href) {
    if (!isExternalHref(href)) {
      return (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
        >
          {content}
        </Link>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
      >
        {content}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      {content}
    </span>
  );
}

function ScoreCard({ plugin }: { plugin: PluginDetail }) {
  const delta = scoreDelta(plugin);
  const isPending = plugin.audited === false;
  const tone = isPending
    ? { border: "border-line", text: "text-muted" }
    : scoreTone(plugin.score);

  return (
    <div className="w-full rounded-md border border-line bg-gradient-to-br from-surface to-surface-subtle/60 p-5 shadow-sm lg:w-80">
      <div className="flex flex-col items-center justify-center">
        <div
          className={`relative flex size-32 items-center justify-center rounded-full border-8 ${tone.border}`}
        >
          <div className={`font-mono text-5xl font-bold ${tone.text}`}>
            {isPending ? "—" : Math.floor(plugin.score)}
          </div>
        </div>
        <div className="mt-3 text-sm font-medium text-muted">
          {isPending ? "Pending scan" : "Score"}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ScoreMetric
          label="Errors"
          value={isPending ? "—" : plugin.errors.toLocaleString()}
          className="border-risk/20 bg-risk/10 text-risk"
        />
        <ScoreMetric
          label="Warnings"
          value={isPending ? "—" : plugin.warnings.toLocaleString()}
          className="border-warn/20 bg-warn/10 text-warn"
        />
        <ScoreMetric
          label="Change"
          value={isPending ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}
          className="border-info/20 bg-info/10 text-info"
        />
      </div>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className={`rounded-md border p-2.5 text-center ${className}`}>
      <div className="font-mono text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs">{label}</div>
    </div>
  );
}

function ScoreBreakdown({ plugin }: { plugin: PluginDetail }) {
  if (plugin.audited === false) {
    return (
      <div className="w-full rounded-md border border-line bg-gradient-to-br from-surface to-surface-subtle/60 p-5 shadow-sm lg:w-80">
        <h2 className="text-base font-semibold">Category Scores</h2>
        <div className="mt-5 rounded-md border border-dashed border-line p-5 text-center text-sm text-muted">
          Pending scan
        </div>
      </div>
    );
  }

  const scores = [
    ["Security", plugin.scores?.security ?? plugin.score],
    ["Repo", plugin.scores?.repo ?? plugin.score],
    ["Performance", plugin.scores?.performance ?? plugin.score],
    ["Maintainability", plugin.scores?.maintainability ?? plugin.score],
  ] as const;

  return (
    <div className="w-full rounded-md border border-line bg-gradient-to-br from-surface to-surface-subtle/60 p-5 shadow-sm lg:w-80">
      <h2 className="text-base font-semibold">Category Scores</h2>
      <div className="mt-5 space-y-4">
        {scores.map(([label, value]) => {
          const clampedValue = Math.max(0, Math.min(100, value));

          return (
            <div key={label}>
              <div className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="font-mono">{clampedValue}</span>
              </div>
              <div className="mt-2 h-2 rounded-md bg-surface-subtle">
                <div
                  className="h-2 rounded-md bg-brand"
                  style={{ width: `${clampedValue}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopIssuesByCategory({
  findings,
}: {
  findings: FindingCodeCount[];
}) {
  const groups = groupFindingCodeCounts(findings);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <div className="border-b border-line p-5">
        <h2 className="text-base font-semibold">Top Issues by Category</h2>
      </div>
      <div className="divide-y divide-line">
        {groups.map((group) => (
          <details key={group.family} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none group-open:bg-surface-subtle [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">{group.family}</span>
              <span className="inline-flex items-center gap-3">
                <span className="text-sm font-medium text-muted">
                  {group.total.toLocaleString()}
                </span>
                <ChevronDown
                  size={17}
                  className="text-muted transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </span>
            </summary>
            <div className="space-y-2 border-t border-line px-5 py-4">
              {group.findings.map((finding, index) => (
                <Link
                  key={`${finding.code}-${finding.severity}`}
                  href={`/issues/${encodeURIComponent(finding.code)}`}
                  className="flex items-center gap-3 rounded-md px-3 py-2 transition hover:bg-surface-subtle"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-medium text-muted">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {finding.title}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted">
                      {finding.code}
                    </span>
                  </span>
                  <SeverityBadge severity={finding.severity} />
                  <span className="w-12 text-right font-mono text-sm text-muted">
                    {finding.count.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function IssuesDetails({ plugin }: { plugin: PluginDetail }) {
  const findings = plugin.topFindings ?? [];

  if (plugin.audited === false) {
    return (
      <section className="rounded-md border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 className="text-base font-semibold">Issues Details</h2>
            <p className="mt-1 text-sm text-muted">Pending scan</p>
          </div>
          <Clock3 size={32} className="text-muted" aria-hidden="true" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 className="text-base font-semibold">Issues Details</h2>
          <p className="mt-1 text-sm text-muted">
            {plugin.findings.toLocaleString()} issue
            {plugin.findings === 1 ? "" : "s"} found in latest scan
          </p>
        </div>
        {plugin.findings === 0 ? (
          <CheckCircle2 size={32} className="text-good" aria-hidden="true" />
        ) : null}
      </div>

      {findings.length === 0 ? (
        <div className="p-5">
          <div className="rounded-md border border-dashed border-line p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-good" />
            <p className="text-sm font-medium">No issues found.</p>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <div className="space-y-3 sm:hidden">
            {findings.map((finding) => (
              <div
                key={finding.code}
                className="rounded-md border border-line bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <SeverityBadge severity={finding.severity} />
                  <span className="shrink-0 font-mono text-sm text-muted">
                    {finding.count.toLocaleString()}
                  </span>
                </div>
                <Link
                  href={`/issues/${encodeURIComponent(finding.code)}`}
                  className="mt-3 block break-all font-mono text-xs leading-5 text-info hover:underline"
                >
                  {finding.code}
                </Link>
                <p className="mt-3 break-words text-sm leading-6 text-muted">
                  {finding.sampleMessage}
                </p>
              </div>
            ))}
          </div>

          <table className="hidden w-full table-fixed border-collapse overflow-hidden rounded-md border border-line text-sm sm:table">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-[38%] px-3 py-3 font-medium sm:px-4">Code</th>
                <th className="w-24 px-3 py-3 font-medium sm:px-4">Type</th>
                <th className="px-3 py-3 font-medium sm:px-4">Message</th>
                <th className="w-16 px-3 py-3 text-right font-medium sm:px-4">Count</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.code} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-4 sm:px-4">
                    <Link
                      href={`/issues/${encodeURIComponent(finding.code)}`}
                      className="break-all font-mono text-[11px] leading-5 text-info hover:underline sm:text-xs"
                    >
                      {finding.code}
                    </Link>
                  </td>
                  <td className="px-3 py-4 sm:px-4">
                    <SeverityBadge severity={finding.severity} />
                  </td>
                  <td className="break-words px-3 py-4 text-muted sm:px-4">
                    {finding.sampleMessage}
                  </td>
                  <td className="px-3 py-4 text-right font-mono sm:px-4">
                    {finding.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ScoreHistory({
  history,
  plugin,
}: {
  history: PluginScoreHistoryPoint[];
  plugin: PluginDetail;
}) {
  const latest = history[history.length - 1];
  const first = history[0];
  const delta = latest && first ? latest.score - first.score : 0;

  return (
    <section className="rounded-md border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Score History</h2>
          <p className="mt-1 text-sm text-muted">
            {history.length > 1
              ? `${history.length.toLocaleString()} score snapshots`
              : history.length === 1
                ? "First score snapshot"
                : plugin.audited === false
                  ? "Scan pending"
                  : "No score snapshots yet"}
          </p>
        </div>
        {history.length > 1 ? (
          <span className="inline-flex w-fit rounded-md border border-line px-3 py-2 font-mono text-sm">
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>

      <div className="space-y-5 p-5">
        {history.length > 1 ? <ScoreTrendChart points={history} /> : null}
        {history.length === 1 && latest ? (
          <div className="rounded-md border border-dashed border-line p-5">
            <p className="text-sm font-medium">
              First scan completed <RelativeDate value={latest.scannedAt} />
            </p>
            <p className="mt-2 break-words text-sm leading-6 text-muted">
              v{latest.pluginVersion} · Plugin Check {latest.pluginCheckVersion} · Model {latest.scoringModelVersion}
            </p>
          </div>
        ) : null}
        {history.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-5 text-sm text-muted">
            No completed scan history yet.
          </div>
        ) : (
          <ScoreHistoryTable points={history} />
        )}
      </div>
    </section>
  );
}

function ScoreTrendChart({ points }: { points: PluginScoreHistoryPoint[] }) {
  const width = 640;
  const height = 220;
  const padX = 42;
  const padTop = 20;
  const padBottom = 36;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padTop - padBottom;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * chartWidth;
    const y = padTop + ((100 - point.score) / 100) * chartHeight;

    return { point, x, y };
  });
  const path = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const latest = points[points.length - 1];
  const first = points[0];

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-background p-4">
      <svg
        role="img"
        aria-label="Score history trend"
        className="block h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[100, 75, 50, 25, 0].map((value) => {
          const y = padTop + ((100 - value) / 100) * chartHeight;

          return (
            <g key={value}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="var(--line)"
                strokeDasharray={value === 0 ? undefined : "4 6"}
              />
              <text
                x={padX - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-muted font-mono text-[10px]"
              >
                {value}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="var(--brand)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {coordinates.map(({ point, x, y }) => (
          <circle
            key={point.auditRunId}
            cx={x}
            cy={y}
            r="5.5"
            fill="var(--surface)"
            stroke="var(--brand)"
            strokeWidth="3"
          >
            <title>{scorePointTitle(point)}</title>
          </circle>
        ))}
        {first ? (
          <text x={padX} y={height - 8} className="fill-muted text-[11px]">
            {formatShortDate(first.scannedAt)}
          </text>
        ) : null}
        {latest ? (
          <text x={width - padX} y={height - 8} textAnchor="end" className="fill-muted text-[11px]">
            {formatShortDate(latest.scannedAt)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function ScoreHistoryTable({ points }: { points: PluginScoreHistoryPoint[] }) {
  const newestFirst = [...points].reverse();

  return (
    <div>
      <div className="space-y-3 sm:hidden">
        {newestFirst.map((point, index) => (
          <div key={point.auditRunId} className="rounded-md border border-line bg-background p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  <RelativeDate value={point.scannedAt} />
                </p>
                <p className="mt-1 font-mono text-xs text-muted">v{point.pluginVersion}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold">{point.score}</p>
                <p className="text-xs text-muted">{index === 0 ? "Latest" : "Score"}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <HistoryMeta label="Findings" value={point.findings.toLocaleString()} />
              <HistoryMeta label="Errors" value={point.errors.toLocaleString()} />
              <HistoryMeta label="Warnings" value={point.warnings.toLocaleString()} />
              <HistoryMeta label="Plugin Check" value={point.pluginCheckVersion} />
              <HistoryMeta label="Model" value={point.scoringModelVersion} className="col-span-2" />
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[780px] w-full table-fixed border-collapse overflow-hidden rounded-md border border-line text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-32 px-3 py-3 font-medium">Scan</th>
              <th className="w-20 px-3 py-3 text-right font-medium">Score</th>
              <th className="w-28 px-3 py-3 text-right font-medium">Findings</th>
              <th className="w-24 px-3 py-3 text-right font-medium">Errors</th>
              <th className="w-24 px-3 py-3 text-right font-medium">Warnings</th>
              <th className="px-3 py-3 font-medium">Plugin</th>
              <th className="px-3 py-3 font-medium">Plugin Check</th>
              <th className="px-3 py-3 font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.map((point, index) => (
              <tr key={point.auditRunId} className="border-b border-line last:border-b-0">
                <td className="px-3 py-4">
                  <span className="block font-medium">
                    <RelativeDate value={point.scannedAt} />
                  </span>
                  {index === 0 ? <span className="mt-1 block text-xs text-muted">Latest</span> : null}
                </td>
                <td className="px-3 py-4 text-right font-mono font-semibold">{point.score}</td>
                <td className="px-3 py-4 text-right font-mono">{point.findings.toLocaleString()}</td>
                <td className="px-3 py-4 text-right font-mono">{point.errors.toLocaleString()}</td>
                <td className="px-3 py-4 text-right font-mono">{point.warnings.toLocaleString()}</td>
                <td className="break-all px-3 py-4 font-mono text-xs">v{point.pluginVersion}</td>
                <td className="break-all px-3 py-4 font-mono text-xs">{point.pluginCheckVersion}</td>
                <td className="break-all px-3 py-4 font-mono text-xs">{point.scoringModelVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryMeta({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-foreground">{value}</dd>
    </div>
  );
}

function PluginRankings({ plugin }: { plugin: PluginDetail }) {
  const rankings = plugin.rankings;

  if (!rankings) {
    return null;
  }

  if (!rankings.overallScore && !rankings.popularity && rankings.tags.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Rankings</h2>
      <div className="mt-4 divide-y divide-line text-sm">
        <RankRow
          label="Overall score"
          value={
            rankings?.overallScore
              ? formatRank(rankings.overallScore)
              : plugin.audited === false
                ? "Pending audit"
                : undefined
          }
        />
        <RankRow
          label="Popularity"
          value={rankings?.popularity ? formatRank(rankings.popularity) : undefined}
        />
      </div>

      {rankings?.tags.length ? (
        <div className="mt-5 space-y-2">
          {rankings.tags.map((tag) => (
            <div
              key={tag.slug}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm"
            >
              <Link
                href={`/tags/${encodeURIComponent(tag.slug)}`}
                className="min-w-0 truncate font-medium text-info hover:underline"
              >
                {tag.name}
              </Link>
              <span className="shrink-0 text-right text-xs text-muted">
                {tag.scoreRank
                  ? `${formatRank(tag.scoreRank)} score`
                  : plugin.audited === false
                    ? "Pending audit"
                    : null}
                {tag.scoreRank && tag.popularityRank ? " · " : ""}
                {tag.popularityRank ? `${formatRank(tag.popularityRank)} popular` : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function RankRow({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function formatRank(rank: { rank: number; total: number }) {
  return `#${rank.rank.toLocaleString()} of ${rank.total.toLocaleString()}`;
}

function PluginMetadata({
  plugin,
  supportRate,
}: {
  plugin: PluginDetail;
  supportRate?: number;
}) {
  const authorHref = plugin.author
    ? `/authors/${encodeURIComponent(plugin.author)}`
    : undefined;

  return (
    <aside className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-base font-semibold">Plugin Metadata</h2>
      <div className="mt-4 divide-y divide-line text-sm">
        <MetaRow label="Author" value={plugin.author} href={authorHref} />
        <MetaRow
          label="Homepage"
          value={plugin.homepageUrl ? "Visit site" : undefined}
          href={plugin.homepageUrl}
        />
        <MetaRow label="Version" value={plugin.version} />
        <MetaRow
          label="Directory age"
          value={formatPluginDirectoryAge(plugin.addedAt)}
        />
        <MetaRow
          label="Added"
          value={plugin.addedAt ? <RelativeDate value={plugin.addedAt} /> : undefined}
        />
        <MetaRow label="Requires WP" value={plugin.requiresWp} />
        <MetaRow label="Tested up to" value={plugin.testedWp} />
        <MetaRow label="Requires PHP" value={plugin.requiresPhp} />
        <MetaRow
          label="Rating"
          value={
            plugin.rating !== undefined
              ? `${plugin.rating}% from ${plugin.ratingCount?.toLocaleString() ?? "0"} reviews`
              : undefined
          }
          icon={<Star size={14} aria-hidden="true" />}
        />
        <MetaRow
          label="Support"
          value={
            supportRate !== undefined
              ? `${supportRate}% resolved (${plugin.supportThreadsResolved}/${plugin.supportThreads})`
              : undefined
          }
        />
      </div>
    </aside>
  );
}

function MetaRow({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value?: ReactNode;
  href?: string;
  icon?: ReactNode;
}) {
  if (!value) {
    return null;
  }

  const content = (
    <span className="inline-flex min-w-0 items-center gap-1 text-right text-foreground">
      {icon}
      <span className="truncate">{value}</span>
      {href && isExternalHref(href) ? <ExternalLink size={13} aria-hidden="true" /> : null}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-muted">{label}</span>
      {href ? (
        isExternalHref(href) ? (
          <a
            href={href}
            className="min-w-0 hover:text-info"
            target="_blank"
            rel="noreferrer"
          >
            {content}
          </a>
        ) : (
          <Link href={href} className="min-w-0 hover:text-info">
            {content}
          </Link>
        )
      ) : (
        content
      )}
    </div>
  );
}

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

function scorePointTitle(point: PluginScoreHistoryPoint) {
  return [
    formatExactDate(point.scannedAt),
    `Score ${point.score}/100`,
    `Plugin v${point.pluginVersion}`,
    `Plugin Check ${point.pluginCheckVersion}`,
    `Scoring model ${point.scoringModelVersion}`,
    `${point.errors.toLocaleString()} errors, ${point.warnings.toLocaleString()} warnings`,
  ].join("\n");
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-background p-4">
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "error" | "warning" }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
        severity === "error"
          ? "border-risk/20 bg-risk/10 text-risk"
          : "border-warn/20 bg-warn/10 text-warn"
      }`}
    >
      {severity.toUpperCase()}
    </span>
  );
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      border: "border-good",
      text: "text-good",
    };
  }

  if (score >= 60) {
    return {
      border: "border-warn",
      text: "text-warn",
    };
  }

  return {
    border: "border-risk",
    text: "text-risk",
  };
}
