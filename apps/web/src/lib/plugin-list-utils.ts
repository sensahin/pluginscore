import type { PluginSummary } from "@/lib/plugin-score-data";

export type PluginListSort =
  | "score_desc"
  | "score_asc"
  | "installs_desc"
  | "downloads_desc"
  | "scanned_desc"
  | "issues_desc";

type PluginWithAudit = PluginSummary & {
  latestAudit?: {
    status?: string;
    completedAt?: string;
  };
};

export function sortPluginSummaries(
  plugins: PluginSummary[],
  sort: PluginListSort,
) {
  return [...plugins].sort((a, b) => {
    if (sort === "score_asc") return a.score - b.score || a.name.localeCompare(b.name);
    if (sort === "issues_desc") return b.findings - a.findings || a.name.localeCompare(b.name);
    if (sort === "installs_desc") return parseCompact(b.activeInstalls) - parseCompact(a.activeInstalls) || a.name.localeCompare(b.name);
    if (sort === "downloads_desc") return parseCompact(b.downloads) - parseCompact(a.downloads) || a.name.localeCompare(b.name);
    if (sort === "scanned_desc") return scanTime(b).localeCompare(scanTime(a)) || a.name.localeCompare(b.name);
    return b.score - a.score || a.name.localeCompare(b.name);
  });
}

export function auditedPlugins(plugins: PluginSummary[]) {
  return plugins.filter(hasCompletedAudit);
}

export function uniquePluginsBySlug(plugins: PluginSummary[]) {
  const bySlug = new Map<string, PluginSummary>();

  for (const plugin of plugins) {
    if (!bySlug.has(plugin.slug)) {
      bySlug.set(plugin.slug, plugin);
    }
  }

  return [...bySlug.values()];
}

export function withoutPlugin(plugins: PluginSummary[], slug: string) {
  return plugins.filter((plugin) => plugin.slug !== slug);
}

function hasCompletedAudit(plugin: PluginSummary) {
  const withAudit = plugin as PluginWithAudit;

  return (
    plugin.audited === true ||
    Boolean(plugin.scannedAt) ||
    withAudit.latestAudit?.status === "complete"
  );
}

function scanTime(plugin: PluginSummary) {
  const withAudit = plugin as PluginWithAudit;
  return plugin.scannedAt ?? withAudit.latestAudit?.completedAt ?? "";
}

function parseCompact(value: string) {
  const normalized = value.toLowerCase().replace("+", "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) return 0;
  if (normalized.endsWith("m")) return parsed * 1_000_000;
  if (normalized.endsWith("k")) return parsed * 1_000;

  return parsed;
}
