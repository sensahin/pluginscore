import type { PluginDetail, PluginScoreHistoryPoint } from "@pluginscore/core";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PluginIcon } from "@/components/plugin-icon";
import { RelativeDate } from "@/components/relative-date";
import { ScoreBadge } from "@/components/score-badge";
import { parseCompactNumber } from "@/lib/compare";
import { groupFindingCodeCounts } from "@/lib/finding-groups";
import { formatExactDate } from "@/lib/formatting";
import { formatPluginDirectoryAge } from "@/lib/plugin-age";

export type ComparisonEntry = {
  plugin: PluginDetail;
  history: PluginScoreHistoryPoint[];
  color: string;
};

export const comparisonChartColors = [
  "var(--brand)",
  "var(--info)",
  "var(--good)",
  "var(--warn)",
];

export function ComparisonPageView({ entries }: { entries: ComparisonEntry[] }) {
  return (
    <AppShell>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              {comparisonTitle(entries)}
            </h1>
          </div>
          <Link
            href="/compare"
            className="inline-flex h-10 w-fit items-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
          >
            New comparison
          </Link>
        </div>

        <VerdictGrid entries={entries} />
        <ComparisonSection title="Summary">
          <ComparisonTable
            entries={entries}
            rows={[
              {
                label: "Plugin",
                values: entries.map((entry) => <PluginHeader key={entry.plugin.slug} entry={entry} />),
              },
              {
                label: "Score",
                values: entries.map((entry) => <ScoreValue key={entry.plugin.slug} plugin={entry.plugin} />),
              },
              {
                label: "Active installs",
                values: entries.map((entry) => entry.plugin.activeInstalls),
              },
              {
                label: "Rating",
                values: entries.map((entry) => formatRating(entry.plugin)),
              },
              {
                label: "Last updated",
                values: entries.map((entry) => <RelativeDate key={entry.plugin.slug} value={entry.plugin.lastUpdated} />),
              },
              {
                label: "Directory age",
                values: entries.map((entry) => formatPluginDirectoryAge(entry.plugin.addedAt) ?? "Unknown"),
              },
            ]}
          />
        </ComparisonSection>

        <ComparisonSection title="Score Comparison">
          <ComparisonTable
            entries={entries}
            rows={[
              {
                label: "Overall score",
                values: entries.map((entry) => <ScoreValue key={entry.plugin.slug} plugin={entry.plugin} />),
              },
              ...(["security", "repo", "performance", "maintainability"] as const).map((key) => ({
                label: scoreLabel(key),
                values: entries.map((entry) => (
                  <ScoreNumber
                    key={`${entry.plugin.slug}-${key}`}
                    plugin={entry.plugin}
                    value={entry.plugin.scores?.[key]}
                  />
                )),
              })),
            ]}
          />
        </ComparisonSection>

        <ComparisonSection title="Findings Comparison">
          <ComparisonTable
            entries={entries}
            rows={[
              {
                label: "Total findings",
                values: entries.map((entry) => auditValue(entry.plugin, entry.plugin.findings.toLocaleString())),
              },
              {
                label: "Errors",
                values: entries.map((entry) => auditValue(entry.plugin, entry.plugin.errors.toLocaleString())),
              },
              {
                label: "Warnings",
                values: entries.map((entry) => auditValue(entry.plugin, entry.plugin.warnings.toLocaleString())),
              },
              {
                label: "Top categories",
                values: entries.map((entry) => <IssueCategoryList key={entry.plugin.slug} plugin={entry.plugin} />),
              },
              {
                label: "Repeated issue codes",
                values: entries.map((entry) => <IssueCodeList key={entry.plugin.slug} plugin={entry.plugin} />),
              },
            ]}
          />
        </ComparisonSection>

        <ComparisonSection title="Plugin Metadata">
          <ComparisonTable
            entries={entries}
            rows={[
              {
                label: "Author",
                values: entries.map((entry) => <AuthorLink key={entry.plugin.slug} plugin={entry.plugin} />),
              },
              {
                label: "Version",
                values: entries.map((entry) => entry.plugin.version),
              },
              {
                label: "Downloads",
                values: entries.map((entry) => entry.plugin.downloads),
              },
              {
                label: "Added to WP.org",
                values: entries.map((entry) => <RelativeDate key={entry.plugin.slug} value={entry.plugin.addedAt} />),
              },
              {
                label: "Requires WP",
                values: entries.map((entry) => formatOptional(entry.plugin.requiresWp)),
              },
              {
                label: "Tested up to",
                values: entries.map((entry) => formatOptional(entry.plugin.testedWp)),
              },
              {
                label: "Requires PHP",
                values: entries.map((entry) => formatOptional(entry.plugin.requiresPhp)),
              },
              {
                label: "Support",
                values: entries.map((entry) => formatSupport(entry.plugin)),
              },
              {
                label: "Latest scan",
                values: entries.map((entry) => latestScanValue(entry)),
              },
            ]}
          />
        </ComparisonSection>

        <HistoryComparison entries={entries} />
      </section>
    </AppShell>
  );
}

function VerdictGrid({ entries }: { entries: ComparisonEntry[] }) {
  const auditedEntries = entries.filter((entry) => entry.plugin.audited !== false);
  const verdicts = [
    {
      label: "Best current score",
      entry: maxBy(auditedEntries, (entry) => entry.plugin.score),
      value: (entry: ComparisonEntry) => `${Math.floor(entry.plugin.score)}/100`,
    },
    {
      label: "Most installed",
      entry: maxBy(entries, (entry) => parseCompactNumber(entry.plugin.activeInstalls)),
      value: (entry: ComparisonEntry) => entry.plugin.activeInstalls,
    },
    {
      label: "Fewest findings",
      entry: minBy(auditedEntries, (entry) => entry.plugin.findings),
      value: (entry: ComparisonEntry) => entry.plugin.findings.toLocaleString(),
    },
    {
      label: "Latest update",
      entry: maxBy(entries, (entry) => Date.parse(entry.plugin.lastUpdated || "")),
      value: (entry: ComparisonEntry) => <RelativeDate value={entry.plugin.lastUpdated} />,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {verdicts.map((verdict) => (
        <article
          key={verdict.label}
          className="rounded-md border border-line bg-surface p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase text-muted">{verdict.label}</p>
          {verdict.entry ? (
            <>
              <Link
                href={`/plugins/${verdict.entry.plugin.slug}`}
                className="mt-2 block truncate font-semibold text-info hover:underline"
                title={verdict.entry.plugin.name}
              >
                {pluginDisplayName(verdict.entry.plugin)}
              </Link>
              <p className="mt-2 font-mono text-2xl font-semibold">
                {verdict.value(verdict.entry)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Pending scans</p>
          )}
        </article>
      ))}
    </div>
  );
}

function ComparisonSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <div className="border-b border-line p-5">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ComparisonTable({
  entries,
  rows,
}: {
  entries: ComparisonEntry[];
  rows: Array<{
    label: string;
    values: ReactNode[];
  }>;
}) {
  const labelColumnWidth = 220;
  const valueColumnWidth = 280;
  const minWidth = labelColumnWidth + entries.length * valueColumnWidth;

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed border-collapse text-sm"
        style={{ minWidth }}
      >
        <colgroup>
          <col style={{ width: labelColumnWidth }} />
          {entries.map((entry) => (
            <col key={entry.plugin.slug} style={{ width: valueColumnWidth }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th className="px-4 py-4 text-left align-top text-xs font-medium uppercase text-muted">
                {row.label}
              </th>
              {entries.map((entry, index) => (
                <td
                  key={`${row.label}-${entry.plugin.slug}`}
                  className="px-4 py-4 align-top"
                >
                  <div className="min-w-0">{row.values[index] ?? "-"}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PluginHeader({ entry }: { entry: ComparisonEntry }) {
  return (
    <Link
      href={`/plugins/${entry.plugin.slug}`}
      className="group flex min-w-0 items-center gap-3"
    >
      <PluginIcon plugin={entry.plugin} size="sm" />
      <span className="min-w-0">
        <span
          className="block truncate font-semibold text-info group-hover:underline"
          title={entry.plugin.name}
        >
          {pluginDisplayName(entry.plugin)}
        </span>
        <span className="mt-1 block font-mono text-xs text-muted">
          {entry.plugin.slug}
        </span>
      </span>
    </Link>
  );
}

function ScoreValue({ plugin }: { plugin: PluginDetail }) {
  if (plugin.audited === false) {
    return <PendingLabel />;
  }

  return <ScoreBadge score={plugin.score} band={plugin.band} />;
}

function ScoreNumber({
  plugin,
  value,
}: {
  plugin: PluginDetail;
  value?: number;
}) {
  if (plugin.audited === false) {
    return <PendingLabel />;
  }

  return (
    <span className="font-mono font-semibold">
      {Math.max(0, Math.min(100, value ?? plugin.score))}
    </span>
  );
}

function PendingLabel() {
  return (
    <span className="inline-flex rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-semibold text-muted">
      Pending
    </span>
  );
}

function IssueCategoryList({ plugin }: { plugin: PluginDetail }) {
  if (plugin.audited === false) {
    return <PendingLabel />;
  }

  const categories = groupFindingCodeCounts(plugin.topFindings ?? []).slice(0, 3);

  if (!categories.length) {
    return <span className="text-muted">None</span>;
  }

  return (
    <div className="space-y-1">
      {categories.map((category) => (
        <div key={category.family} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{category.family}</span>
          <span className="shrink-0 font-mono text-xs text-muted">
            {category.total.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function IssueCodeList({ plugin }: { plugin: PluginDetail }) {
  if (plugin.audited === false) {
    return <PendingLabel />;
  }

  const findings = (plugin.topFindings ?? []).slice(0, 3);

  if (!findings.length) {
    return <span className="text-muted">None</span>;
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => (
        <Link
          key={finding.code}
          href={`/issues/${encodeURIComponent(finding.code)}`}
          className="block break-all font-mono text-xs leading-5 text-info hover:underline"
        >
          {finding.code}
          <span className="ml-2 text-muted">({finding.count.toLocaleString()})</span>
        </Link>
      ))}
    </div>
  );
}

function AuthorLink({ plugin }: { plugin: PluginDetail }) {
  if (!plugin.author) {
    return <span className="text-muted">Unknown</span>;
  }

  return (
    <Link
      href={`/authors/${encodeURIComponent(authorRouteKey(plugin.author, plugin.authorUrl))}`}
      className="text-info hover:underline"
    >
      {plugin.author}
    </Link>
  );
}

function authorRouteKey(name: string, profileUrl?: string) {
  const profileSlug = authorSlugFromProfileUrl(profileUrl);
  return profileSlug ?? name;
}

function authorSlugFromProfileUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.hostname.toLowerCase() !== "profiles.wordpress.org") {
      return null;
    }

    return url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function HistoryComparison({ entries }: { entries: ComparisonEntry[] }) {
  const rows = entries
    .flatMap((entry) =>
      entry.history.map((point) => ({
        plugin: entry.plugin,
        color: entry.color,
        point,
      })),
    )
    .sort((a, b) => Date.parse(b.point.scannedAt) - Date.parse(a.point.scannedAt));

  return (
    <ComparisonSection title="Score History">
      <div className="space-y-5 p-5">
        {rows.length > 0 ? (
          <>
            <ComparisonTrendChart entries={entries} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse overflow-hidden rounded-md border border-line text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="w-56 px-3 py-3 font-medium">Plugin</th>
                    <th className="w-32 px-3 py-3 font-medium">Scan</th>
                    <th className="w-20 px-3 py-3 text-right font-medium">Score</th>
                    <th className="w-28 px-3 py-3 text-right font-medium">Findings</th>
                    <th className="px-3 py-3 font-medium">Plugin Version</th>
                    <th className="px-3 py-3 font-medium">Plugin Check</th>
                    <th className="px-3 py-3 font-medium">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ plugin, point, color }) => (
                    <tr
                      key={`${plugin.slug}-${point.auditRunId}`}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-3 py-4">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <Link
                            href={`/plugins/${plugin.slug}`}
                            className="truncate text-info hover:underline"
                          >
                            {pluginDisplayName(plugin)}
                          </Link>
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <RelativeDate value={point.scannedAt} />
                      </td>
                      <td className="px-3 py-4 text-right font-mono font-semibold">
                        {point.score}
                      </td>
                      <td className="px-3 py-4 text-right font-mono">
                        {point.findings.toLocaleString()}
                      </td>
                      <td className="break-all px-3 py-4 font-mono text-xs">
                        v{point.pluginVersion}
                      </td>
                      <td className="break-all px-3 py-4 font-mono text-xs">
                        {point.pluginCheckVersion}
                      </td>
                      <td className="break-all px-3 py-4 font-mono text-xs">
                        {point.scoringModelVersion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-line p-5 text-sm text-muted">
            No completed scan history yet.
          </div>
        )}
      </div>
    </ComparisonSection>
  );
}

function ComparisonTrendChart({ entries }: { entries: ComparisonEntry[] }) {
  const width = 720;
  const height = 220;
  const padX = 42;
  const padTop = 22;
  const padBottom = 34;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padTop - padBottom;
  const timestampValues = entries
    .flatMap((entry) => entry.history.map((point) => Date.parse(point.scannedAt)))
    .filter(Number.isFinite);
  const minTime = Math.min(...timestampValues);
  const maxTime = Math.max(...timestampValues);
  const hasTimeRange = Number.isFinite(minTime) && Number.isFinite(maxTime) && maxTime > minTime;

  return (
    <div className="rounded-md border border-line bg-background p-4">
      <svg
        role="img"
        aria-label="Compared score history"
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
        {entries.map((entry) => {
          const points = [...entry.history].sort(
            (a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt),
          );
          const coordinates = points.map((point, index) => {
            const parsedTime = Date.parse(point.scannedAt);
            const x = hasTimeRange && Number.isFinite(parsedTime)
              ? padX + ((parsedTime - minTime) / (maxTime - minTime)) * chartWidth
              : points.length === 1
                ? width / 2
                : padX + (index / (points.length - 1)) * chartWidth;
            const y = padTop + ((100 - point.score) / 100) * chartHeight;

            return { point, x, y };
          });
          const path = coordinates
            .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
            .join(" ");

          return (
            <g key={entry.plugin.slug}>
              {coordinates.length > 1 ? (
                <path
                  d={path}
                  fill="none"
                  stroke={entry.color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
              ) : null}
              {coordinates.map(({ point, x, y }) => (
                <circle
                  key={point.auditRunId}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="var(--surface)"
                  stroke={entry.color}
                  strokeWidth="3"
                >
                  <title>{scorePointTitle(entry.plugin, point)}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        {entries.map((entry) => (
          <span key={entry.plugin.slug} className="inline-flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate">{pluginDisplayName(entry.plugin)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function auditValue(plugin: PluginDetail, value: ReactNode) {
  return plugin.audited === false ? <PendingLabel /> : value;
}

function latestScanValue(entry: ComparisonEntry) {
  const latest = entry.history[entry.history.length - 1];

  if (!latest) {
    return entry.plugin.audited === false ? <PendingLabel /> : <span className="text-muted">None</span>;
  }

  return (
    <span className="block min-w-0">
      <span className="block">
        <RelativeDate value={latest.scannedAt} />
      </span>
      <span className="mt-1 block break-all font-mono text-xs text-muted">
        Check {latest.pluginCheckVersion} / Model {latest.scoringModelVersion}
      </span>
    </span>
  );
}

function comparisonTitle(entries: ComparisonEntry[]) {
  return entries.map((entry) => pluginDisplayName(entry.plugin)).join(" vs ");
}

export function pluginDisplayName(plugin: PluginDetail) {
  const shortName = plugin.name
    .split(/\s+(?:\u2013|\u2014|-)\s+|:\s+/)[0]
    ?.replace(/\s+/g, " ")
    .trim();

  return shortName && shortName.length >= 4 ? shortName : plugin.name;
}

function scoreLabel(value: keyof NonNullable<PluginDetail["scores"]>) {
  return {
    security: "Security",
    repo: "Repo",
    performance: "Performance",
    maintainability: "Maintainability",
  }[value];
}

function formatRating(plugin: PluginDetail) {
  if (plugin.rating === undefined) {
    return "Unknown";
  }

  return `${plugin.rating}% from ${plugin.ratingCount?.toLocaleString() ?? "0"} reviews`;
}

function formatSupport(plugin: PluginDetail) {
  if (!plugin.supportThreads || plugin.supportThreadsResolved === undefined) {
    return "Unknown";
  }

  const supportRate = Math.round((plugin.supportThreadsResolved / plugin.supportThreads) * 100);

  return `${supportRate}% resolved (${plugin.supportThreadsResolved}/${plugin.supportThreads})`;
}

function formatOptional(value?: string) {
  return value?.trim() || "Unknown";
}

function scorePointTitle(plugin: PluginDetail, point: PluginScoreHistoryPoint) {
  return [
    plugin.name,
    formatExactDate(point.scannedAt),
    `Score ${point.score}/100`,
    `Plugin v${point.pluginVersion}`,
    `Plugin Check ${point.pluginCheckVersion}`,
    `Scoring model ${point.scoringModelVersion}`,
    `${point.errors.toLocaleString()} errors, ${point.warnings.toLocaleString()} warnings`,
  ].join("\n");
}

function maxBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => {
    const itemValue = value(item);
    const bestValue = best ? value(best) : Number.NEGATIVE_INFINITY;

    if (!Number.isFinite(itemValue)) {
      return best;
    }

    return !best || itemValue > bestValue ? item : best;
  }, undefined);
}

function minBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<T | undefined>((best, item) => {
    const itemValue = value(item);
    const bestValue = best ? value(best) : Number.POSITIVE_INFINITY;

    if (!Number.isFinite(itemValue)) {
      return best;
    }

    return !best || itemValue < bestValue ? item : best;
  }, undefined);
}
