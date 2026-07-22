import { normalizeComparisonSlugs } from "@/lib/compare";

export const RECENT_COMPARISONS_STORAGE_KEY =
  "pluginscore:recent-comparisons:v1";
const RECENT_COMPARISON_LIMIT = 6;

export type RecentComparisonPlugin = {
  slug: string;
  name: string;
  iconUrl?: string;
};

export type RecentComparison = {
  pluginSlugs: string[];
  plugins: RecentComparisonPlugin[];
  comparedAt: string;
};

export function readRecentComparisons(storage: Storage): RecentComparison[] {
  try {
    return parseRecentComparisons(
      storage.getItem(RECENT_COMPARISONS_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

export function parseRecentComparisons(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .map(readRecentComparison)
          .filter((comparison): comparison is RecentComparison => Boolean(comparison))
          .slice(0, RECENT_COMPARISON_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function saveRecentComparison(
  storage: Storage,
  plugins: RecentComparisonPlugin[],
) {
  const pluginBySlug = new Map(plugins.map((plugin) => [plugin.slug, plugin]));
  const pluginSlugs = normalizeComparisonSlugs(plugins.map((plugin) => plugin.slug));
  const normalizedPlugins = pluginSlugs
    .map((slug) => pluginBySlug.get(slug))
    .filter((plugin): plugin is RecentComparisonPlugin => Boolean(plugin));

  if (normalizedPlugins.length !== pluginSlugs.length || pluginSlugs.length < 2) {
    return readRecentComparisons(storage);
  }

  const comparison: RecentComparison = {
    pluginSlugs,
    plugins: normalizedPlugins,
    comparedAt: new Date().toISOString(),
  };
  const comparisonKey = JSON.stringify(pluginSlugs);
  const recent = [
    comparison,
    ...readRecentComparisons(storage).filter(
      (item) => JSON.stringify(item.pluginSlugs) !== comparisonKey,
    ),
  ].slice(0, RECENT_COMPARISON_LIMIT);

  try {
    storage.setItem(RECENT_COMPARISONS_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    return recent;
  }

  return recent;
}

function readRecentComparison(value: unknown): RecentComparison | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.plugins) || typeof record.comparedAt !== "string") {
    return null;
  }

  const plugins = record.plugins
    .map(readRecentPlugin)
    .filter((plugin): plugin is RecentComparisonPlugin => Boolean(plugin));
  const pluginSlugs = normalizeComparisonSlugs(plugins.map((plugin) => plugin.slug));

  if (pluginSlugs.length < 2 || plugins.length !== pluginSlugs.length) {
    return null;
  }

  const pluginBySlug = new Map(plugins.map((plugin) => [plugin.slug, plugin]));
  return {
    pluginSlugs,
    plugins: pluginSlugs
      .map((slug) => pluginBySlug.get(slug))
      .filter((plugin): plugin is RecentComparisonPlugin => Boolean(plugin)),
    comparedAt: record.comparedAt,
  };
}

function readRecentPlugin(value: unknown): RecentComparisonPlugin | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.slug !== "string" || typeof record.name !== "string") {
    return null;
  }

  const slug = normalizeComparisonSlugs([record.slug])[0];
  const name = record.name.trim();
  if (!slug || !name) {
    return null;
  }

  return {
    slug,
    name,
    ...(typeof record.iconUrl === "string" && record.iconUrl
      ? { iconUrl: record.iconUrl }
      : {}),
  };
}
