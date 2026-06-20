"use client";

import { ArrowRight, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  canonicalComparePath,
  MAX_COMPARE_PLUGINS,
  MIN_COMPARE_PLUGINS,
  normalizePluginSlug,
  parseCompactNumber,
} from "@/lib/compare";

type ComparePlugin = {
  slug: string;
  name: string;
  activeInstalls: string;
  rating?: number;
  ratingCount?: number;
  lastUpdated: string;
  score: number;
};

export function CompareBuilder({
  plugins,
  initialSlugs = [],
}: {
  plugins: ComparePlugin[];
  initialSlugs?: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState(() =>
    initialSlugs
      .map(normalizePluginSlug)
      .filter((slug, index, slugs) => slug && slugs.indexOf(slug) === index)
      .slice(0, MAX_COMPARE_PLUGINS),
  );
  const pluginBySlug = useMemo(
    () => new Map(plugins.map((plugin) => [plugin.slug, plugin])),
    [plugins],
  );
  const selectedPlugins = selectedSlugs.map((slug) => {
    const plugin = pluginBySlug.get(slug);

    return {
      slug,
      name: plugin?.name ?? slug,
    };
  });
  const suggestions = useMemo(
    () =>
      getSuggestions(plugins, query)
        .filter((plugin) => !selectedSlugs.includes(plugin.slug))
        .slice(0, 8),
    [plugins, query, selectedSlugs],
  );
  const canAddMore = selectedSlugs.length < MAX_COMPARE_PLUGINS;
  const canCompare = selectedSlugs.length >= MIN_COMPARE_PLUGINS;

  function addPlugin(slug: string) {
    if (!canAddMore || selectedSlugs.includes(slug)) {
      return;
    }

    setSelectedSlugs((current) => [...current, slug].slice(0, MAX_COMPARE_PLUGINS));
    setQuery("");
  }

  function removePlugin(slug: string) {
    setSelectedSlugs((current) => current.filter((selectedSlug) => selectedSlug !== slug));
  }

  function compare() {
    if (!canCompare) {
      return;
    }

    router.push(canonicalComparePath(selectedSlugs));
  }

  return (
    <div className="rounded-md border border-line bg-surface shadow-sm">
      <div className="border-b border-line p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Select Plugins</h2>
          <button
            type="button"
            onClick={compare}
            disabled={!canCompare}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {selectedPlugins.map((plugin) => (
            <span
              key={plugin.slug}
              className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm font-medium"
            >
              <span className="truncate">{plugin.name}</span>
              <button
                type="button"
                onClick={() => removePlugin(plugin.slug)}
                className="shrink-0 rounded-md text-muted transition hover:text-foreground"
                aria-label={`Remove ${plugin.name}`}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </span>
          ))}
          {selectedPlugins.length === 0 ? (
            <span className="text-sm text-muted">Choose 2-4 plugins.</span>
          ) : null}
        </div>

        {canAddMore ? (
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full rounded-md border border-line bg-background pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-muted focus:border-brand"
              placeholder="Search plugin to add"
              autoComplete="off"
              spellCheck={false}
            />
            {query.trim() && suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-auto rounded-md border border-line bg-surface py-2 shadow-lg">
                {suggestions.map((plugin) => (
                  <button
                    key={plugin.slug}
                    type="button"
                    onClick={() => addPlugin(plugin.slug)}
                    className="flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-surface-subtle"
                  >
                    <span className="min-w-0 truncate font-medium">{plugin.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {plugin.activeInstalls}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {query.trim() && suggestions.length === 0 ? (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
            No indexed plugin matched that search.
          </div>
        ) : null}

        {selectedSlugs.length === 1 ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted">
            <Plus size={15} aria-hidden="true" />
            Add one more plugin.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getSuggestions(plugins: ComparePlugin[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  return plugins
    .map((plugin) => ({
      plugin,
      rank: matchRank(plugin, normalizedQuery),
    }))
    .filter((match) => match.rank < 3)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return comparePluginSuggestionRank(a.plugin, b.plugin);
    })
    .map((match) => match.plugin);
}

function matchRank(plugin: ComparePlugin, query: string) {
  const name = normalizeSearchText(plugin.name);
  const slug = normalizeSearchText(plugin.slug);

  if (name.startsWith(query) || slug.startsWith(query)) return 0;
  if (query.length > 1 && (name.includes(query) || slug.includes(query))) return 1;

  return 3;
}

function comparePluginSuggestionRank(a: ComparePlugin, b: ComparePlugin) {
  return (
    parseCompactNumber(b.activeInstalls) - parseCompactNumber(a.activeInstalls) ||
    (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    Date.parse(b.lastUpdated || "") - Date.parse(a.lastUpdated || "") ||
    b.score - a.score ||
    a.name.localeCompare(b.name)
  );
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}
