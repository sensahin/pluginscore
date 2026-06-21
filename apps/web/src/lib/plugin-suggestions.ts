import type { PluginSummary } from "@/lib/plugin-score-data";

export type PluginSuggestion = Pick<
  PluginSummary,
  | "slug"
  | "name"
  | "activeInstalls"
  | "downloads"
  | "lastUpdated"
  | "rating"
  | "ratingCount"
  | "score"
  | "audited"
>;

export const LOCAL_PLUGIN_SUGGESTION_LIMIT = 80;
export const REMOTE_PLUGIN_SUGGESTION_LIMIT = 8;

type PluginSuggestionsResponse = {
  items?: PluginSuggestion[];
};

export async function fetchPluginSuggestions(
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: query,
    limit: String(REMOTE_PLUGIN_SUGGESTION_LIMIT),
  });
  const response = await fetch(`/api/plugins/search?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Unable to load plugin suggestions.");
  }

  const data = (await response.json()) as PluginSuggestionsResponse;
  return data.items ?? [];
}

export function getRankedPluginSuggestions(
  plugins: PluginSuggestion[],
  query: string,
  limit = REMOTE_PLUGIN_SUGGESTION_LIMIT,
) {
  const normalizedQuery = normalizeSuggestionText(query);

  if (!normalizedQuery) {
    return [];
  }

  return plugins
    .map((plugin) => ({
      plugin,
      rank: matchSuggestionRank(plugin, normalizedQuery),
    }))
    .filter((match) => match.rank < 3)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return compareSuggestionPopularity(a.plugin, b.plugin);
    })
    .slice(0, limit)
    .map((match) => match.plugin);
}

export function normalizeSuggestionText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchSuggestionRank(plugin: PluginSuggestion, query: string) {
  const name = normalizeSuggestionText(plugin.name);
  const slug = normalizeSuggestionText(plugin.slug);

  if (name.startsWith(query) || slug.startsWith(query)) return 0;
  if (query.length > 1 && (name.includes(query) || slug.includes(query))) return 1;

  return 3;
}

function compareSuggestionPopularity(a: PluginSuggestion, b: PluginSuggestion) {
  return (
    parseCompactValue(b.activeInstalls) - parseCompactValue(a.activeInstalls) ||
    (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    Date.parse(b.lastUpdated || "") - Date.parse(a.lastUpdated || "") ||
    b.score - a.score ||
    parseCompactValue(b.downloads) - parseCompactValue(a.downloads) ||
    a.name.localeCompare(b.name)
  );
}

function parseCompactValue(value: string) {
  const normalized = value.toLowerCase().replace("+", "").trim();
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) return 0;
  if (normalized.endsWith("m")) return parsed * 1_000_000;
  if (normalized.endsWith("k")) return parsed * 1_000;

  return parsed;
}
