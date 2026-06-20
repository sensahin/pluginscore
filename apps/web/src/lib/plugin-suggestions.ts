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
>;

type PluginSuggestionsResponse = {
  items?: PluginSuggestion[];
};

export async function fetchPluginSuggestions(
  query: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
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
