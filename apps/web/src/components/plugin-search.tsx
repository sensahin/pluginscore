"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";
import {
  normalizePluginSubmissionInput,
  submitPluginForScan,
} from "@/lib/plugin-submission";
import {
  getRankedPluginSuggestions,
  type PluginSuggestion,
} from "@/lib/plugin-suggestions";
import { usePluginSuggestions } from "@/lib/use-plugin-suggestions";

type SearchPlugin = PluginSuggestion;

export function PluginSearch({
  plugins,
  initialQuery = "",
}: {
  plugins: SearchPlugin[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const listboxId = useId();
  const inputId = `${listboxId}-input`;
  const [query, setQuery] = useState(initialQuery);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const {
    items: remoteSuggestions,
    isLoading: isLoadingSuggestions,
    trimmedQuery,
  } = usePluginSuggestions(query);
  const submissionSlug = normalizePluginSubmissionInput(trimmedQuery);
  const localSuggestions = useMemo(
    () => getRankedPluginSuggestions(plugins, trimmedQuery),
    [plugins, trimmedQuery],
  );
  const suggestions = remoteSuggestions ?? localSuggestions;
  const pluginsByKey = useMemo(
    () =>
      new Map(
        [...plugins, ...suggestions].flatMap((plugin) => [
          [plugin.name.trim().toLowerCase(), plugin.slug],
          [plugin.slug.trim().toLowerCase(), plugin.slug],
        ]),
    ),
    [plugins, suggestions],
  );
  const safeHighlightedIndex =
    suggestions.length > 0
      ? Math.min(highlightedIndex, suggestions.length - 1)
      : -1;
  const highlightedPlugin =
    safeHighlightedIndex >= 0 ? suggestions[safeHighlightedIndex] : undefined;
  const showSuggestions = isPanelOpen && trimmedQuery.length > 0 && suggestions.length > 0;
  const showSubmitAction =
    isPanelOpen &&
    trimmedQuery.length > 0 &&
    suggestions.length === 0 &&
    remoteSuggestions !== null &&
    !isLoadingSuggestions &&
    submissionSlug.length > 0;
  const showPanel = showSuggestions || showSubmitAction;
  const activeDescendantId = showSuggestions
    ? `${listboxId}-option-${safeHighlightedIndex}`
    : showSubmitAction
      ? `${listboxId}-submit`
      : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exactSlug = findExactPluginSlug(trimmedQuery, pluginsByKey);
    const slug = exactSlug || highlightedPlugin?.slug || "";

    if (slug) {
      navigateToPlugin(slug);
      return;
    }

    if (showSubmitAction) {
      await submitFromWordPress();
      return;
    }

    if (trimmedQuery) {
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsPanelOpen(false);
      return;
    }

    if (event.key === "Enter" && (showSuggestions || showSubmitAction)) {
      event.preventDefault();

      if (highlightedPlugin) {
        navigateToPlugin(highlightedPlugin.slug);
        return;
      }

      if (showSubmitAction) {
        void submitFromWordPress();
      }

      return;
    }

    if (event.key === "ArrowDown") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
      setIsPanelOpen(true);
      return;
    }

    if (event.key === "ArrowUp") {
      if (!showSuggestions) return;
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      setIsPanelOpen(true);
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

  function navigateToPlugin(slug: string) {
    void fetch("/api/searches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);

    router.push(`/plugins/${encodeURIComponent(slug)}`);
  }

  async function submitFromWordPress() {
    if (isSubmitting) {
      return;
    }

    setSubmissionError("");
    setIsSubmitting(true);

    try {
      const result = await submitPluginForScan(trimmedQuery);
      void fetch("/api/searches", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ slug: result.slug }),
      }).catch(() => undefined);

      router.push(result.pluginUrl);
      router.refresh();
    } catch (error) {
      setSubmissionError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full"
    >
      <label className="sr-only" htmlFor={inputId}>
        Search plugins
      </label>
      <div className="relative min-w-0">
        <Search
          size={21}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={showPanel ? listboxId : undefined}
          aria-haspopup="listbox"
          aria-expanded={showPanel}
          aria-activedescendant={activeDescendantId}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setIsPanelOpen(true)}
          onBlur={() => setIsPanelOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
            setIsPanelOpen(true);
            setSubmissionError("");
          }}
          onKeyDown={handleKeyDown}
          className="h-16 w-full rounded-md border border-line bg-surface pl-14 pr-12 text-lg font-medium shadow-sm outline-none transition placeholder:text-muted focus:border-brand focus:bg-background"
          placeholder="Search WordPress plugins"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setHighlightedIndex(0);
              setIsPanelOpen(false);
            }}
            className="absolute right-4 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground"
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Plugin suggestions"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-md border border-line bg-surface py-2 text-left shadow-lg"
        >
          {showSuggestions
            ? suggestions.map((plugin, index) => (
                <button
                  key={plugin.slug}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === safeHighlightedIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => navigateToPlugin(plugin.slug)}
                  className={`flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-left transition ${
                    index === safeHighlightedIndex ? "bg-surface-subtle" : "hover:bg-surface-subtle"
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{plugin.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {plugin.activeInstalls}
                  </span>
                </button>
              ))
            : null}
          {showSubmitAction ? (
            <button
              id={`${listboxId}-submit`}
              type="button"
              role="option"
              aria-selected="true"
              disabled={isSubmitting}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submitFromWordPress}
              className="flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0 truncate font-medium">
                Scan &quot;{submissionSlug}&quot; from WordPress.org
              </span>
              {isSubmitting ? (
                <Loader2 size={16} className="shrink-0 animate-spin text-muted" aria-hidden="true" />
              ) : null}
            </button>
          ) : null}
          {submissionError ? (
            <div className="px-4 pb-2 pt-1 text-sm text-risk">{submissionError}</div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function findExactPluginSlug(
  value: string,
  pluginsByKey: Map<string, string>,
) {
  if (!value) return "";

  const normalizedInput = normalizePluginSlug(value);
  return (
    pluginsByKey.get(value.toLowerCase()) ??
    pluginsByKey.get(normalizedInput) ??
    ""
  );
}

function normalizePluginSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\/wordpress\.org\/plugins\//, "")
    .replace(/^wordpress\.org\/plugins\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
