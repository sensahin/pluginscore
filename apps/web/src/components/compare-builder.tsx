"use client";

import { ArrowRight, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";
import {
  canonicalComparePath,
  MAX_COMPARE_PLUGINS,
  MIN_COMPARE_PLUGINS,
  normalizePluginSlug,
} from "@/lib/compare";
import {
  getRankedPluginSuggestions,
  type PluginSuggestion,
} from "@/lib/plugin-suggestions";
import { usePluginSuggestions } from "@/lib/use-plugin-suggestions";

type ComparePlugin = PluginSuggestion;

export function CompareBuilder({
  plugins,
  initialSlugs = [],
}: {
  plugins: ComparePlugin[];
  initialSlugs?: string[];
}) {
  const router = useRouter();
  const listboxId = useId();
  const inputId = `${listboxId}-input`;
  const [query, setQuery] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedSlugs, setSelectedSlugs] = useState(() =>
    initialSlugs
      .map(normalizePluginSlug)
      .filter((slug, index, slugs) => slug && slugs.indexOf(slug) === index)
      .slice(0, MAX_COMPARE_PLUGINS),
  );
  const [addedPlugins, setAddedPlugins] = useState<ComparePlugin[]>([]);
  const {
    items: remoteSuggestions,
    isLoading: isLoadingSuggestions,
    trimmedQuery,
  } = usePluginSuggestions(query);
  const localSuggestions = useMemo(
    () => getRankedPluginSuggestions(plugins, trimmedQuery),
    [plugins, trimmedQuery],
  );
  const suggestions = useMemo(
    () =>
      (remoteSuggestions ?? localSuggestions)
        .filter((plugin) => !selectedSlugs.includes(plugin.slug))
        .slice(0, 8),
    [localSuggestions, remoteSuggestions, selectedSlugs],
  );
  const pluginBySlug = useMemo(
    () => new Map([...plugins, ...addedPlugins, ...suggestions].map((plugin) => [plugin.slug, plugin])),
    [addedPlugins, plugins, suggestions],
  );
  const selectedPlugins = selectedSlugs.map((slug) => {
    const plugin = pluginBySlug.get(slug);

    return {
      slug,
      name: plugin?.name ?? slug,
    };
  });
  const canAddMore = selectedSlugs.length < MAX_COMPARE_PLUGINS;
  const canCompare = selectedSlugs.length >= MIN_COMPARE_PLUGINS;
  const safeHighlightedIndex =
    suggestions.length > 0
      ? Math.min(highlightedIndex, suggestions.length - 1)
      : -1;
  const highlightedPlugin =
    safeHighlightedIndex >= 0 ? suggestions[safeHighlightedIndex] : undefined;
  const showSuggestions =
    canAddMore && isPanelOpen && trimmedQuery.length > 0 && suggestions.length > 0;
  const showEmptyState =
    canAddMore &&
    isPanelOpen &&
    trimmedQuery.length > 0 &&
    remoteSuggestions !== null &&
    !isLoadingSuggestions &&
    suggestions.length === 0;

  function addPlugin(slug: string) {
    if (!canAddMore || selectedSlugs.includes(slug)) {
      return;
    }

    const plugin = suggestions.find((suggestion) => suggestion.slug === slug);
    if (plugin) {
      setAddedPlugins((current) =>
        current.some((knownPlugin) => knownPlugin.slug === plugin.slug)
          ? current
          : [...current, plugin],
      );
    }

    setSelectedSlugs((current) => [...current, slug].slice(0, MAX_COMPARE_PLUGINS));
    setQuery("");
    setHighlightedIndex(0);
    setIsPanelOpen(false);
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

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsPanelOpen(false);
      return;
    }

    if (event.key === "Enter" && showSuggestions && highlightedPlugin) {
      event.preventDefault();
      addPlugin(highlightedPlugin.slug);
      return;
    }

    if (event.key === "ArrowDown") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Home") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (event.key === "End") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex(suggestions.length - 1);
    }
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
            <label className="sr-only" htmlFor={inputId}>
              Search plugin to add
            </label>
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id={inputId}
              value={query}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={showSuggestions ? listboxId : undefined}
              aria-haspopup="listbox"
              aria-expanded={showSuggestions}
              aria-activedescendant={
                showSuggestions ? `${listboxId}-option-${safeHighlightedIndex}` : undefined
              }
              onFocus={() => setIsPanelOpen(true)}
              onBlur={() => setIsPanelOpen(false)}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedIndex(0);
                setIsPanelOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              className="h-12 w-full rounded-md border border-line bg-background pl-11 pr-4 text-sm font-medium outline-none transition placeholder:text-muted focus:border-brand"
              placeholder="Search plugin to add"
              autoComplete="off"
              spellCheck={false}
            />
            {showSuggestions ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Plugins to compare"
                className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-auto rounded-md border border-line bg-surface py-2 shadow-lg"
              >
                {suggestions.map((plugin, index) => (
                  <button
                    key={plugin.slug}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === safeHighlightedIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => addPlugin(plugin.slug)}
                    className={`flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-left text-sm transition ${
                      index === safeHighlightedIndex ? "bg-surface-subtle" : "hover:bg-surface-subtle"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{plugin.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {plugin.slug}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted">
                      <span>{plugin.activeInstalls}</span>
                      {plugin.audited ? (
                        <span className="font-mono text-foreground">{plugin.score} score</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showEmptyState ? (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
            <p className="font-medium text-foreground">No indexed plugin matched that search.</p>
            <p className="mt-1">
              Search the main index, or scan it from WordPress.org if it exists.
            </p>
            <Link
              href={`/search?q=${encodeURIComponent(trimmedQuery)}`}
              className="mt-3 inline-flex h-9 items-center rounded-md border border-line px-3 text-sm font-semibold text-foreground transition hover:bg-surface-subtle"
            >
              Search main index
            </Link>
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
