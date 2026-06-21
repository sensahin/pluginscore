"use client";

import { CheckCircle2, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import {
  lookupWordPressPlugin,
  type WordPressPluginLookupResult,
} from "@/lib/plugin-lookup";
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
type LookupState =
  | { status: "idle" }
  | { status: "checking"; input: string }
  | { status: "found"; input: string; plugin: WordPressPluginLookupResult }
  | { status: "not_found"; input: string; message: string }
  | { status: "error"; input: string; message: string };

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
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
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
  const hasQuery = trimmedQuery.length > 0;
  const showSuggestions = isPanelOpen && hasQuery && suggestions.length > 0;
  const showTypingState =
    isPanelOpen &&
    hasQuery &&
    remoteSuggestions === null &&
    !isLoadingSuggestions &&
    suggestions.length === 0;
  const showCheckingIndex =
    isPanelOpen && hasQuery && isLoadingSuggestions && suggestions.length === 0;
  const showCheckingIndexFooter = showSuggestions && isLoadingSuggestions;
  const showNoIndexedState =
    isPanelOpen &&
    hasQuery &&
    remoteSuggestions !== null &&
    !isLoadingSuggestions &&
    suggestions.length === 0 &&
    lookupState.status === "idle";
  const showLookupState = isPanelOpen && hasQuery && lookupState.status !== "idle";
  const showPanel =
    showSuggestions ||
    showTypingState ||
    showCheckingIndex ||
    showNoIndexedState ||
    showLookupState ||
    Boolean(submissionError);
  const activeDescendantId = showSuggestions
    ? `${listboxId}-option-${safeHighlightedIndex}`
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const exactSlug = findExactPluginSlug(trimmedQuery, pluginsByKey);
    const slug = exactSlug || highlightedPlugin?.slug || "";

    if (slug) {
      navigateToPlugin(slug);
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

    if (event.key === "Enter" && showSuggestions) {
      event.preventDefault();

      if (highlightedPlugin) {
        navigateToPlugin(highlightedPlugin.slug);
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

  async function checkWordPressOrg() {
    const input = trimmedQuery;
    if (!input || lookupState.status === "checking") {
      return;
    }

    setSubmissionError("");
    setLookupState({ status: "checking", input });

    try {
      const plugin = await lookupWordPressPlugin(input);
      setLookupState((current) =>
        current.status === "checking" && current.input === input
          ? { status: "found", input, plugin }
          : current,
      );
    } catch (error) {
      const message = (error as Error).message;
      setLookupState((current) =>
        current.status === "checking" && current.input === input
          ? {
              status: message === "No WordPress.org plugin found." ? "not_found" : "error",
              input,
              message,
            }
          : current,
      );
    }
  }

  async function submitFromWordPress(input = trimmedQuery) {
    if (isSubmitting) {
      return;
    }

    setSubmissionError("");
    setIsSubmitting(true);

    try {
      const result = await submitPluginForScan(input);
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
          aria-controls={showSuggestions ? listboxId : undefined}
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
            setLookupState({ status: "idle" });
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
              setSubmissionError("");
              setLookupState({ status: "idle" });
            }}
            className="absolute right-4 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground"
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-md border border-line bg-surface py-2 text-left shadow-lg"
        >
          {showTypingState ? (
            <SearchStateRow title="Typing..." description="Preparing plugin suggestions." />
          ) : null}
          {showCheckingIndex ? (
            <SearchStateRow
              icon={<Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              title="Searching indexed plugins"
              description="Checking PluginScore results."
            />
          ) : null}
          {showSuggestions ? (
            <>
              <div className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Indexed results
              </div>
              <div id={listboxId} role="listbox" aria-label="Plugin suggestions">
                {suggestions.map((plugin, index) => (
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
            </>
          ) : null}
          {showCheckingIndexFooter ? (
            <SearchStateRow
              icon={<Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              title="Checking full index"
              compact
            />
          ) : null}
          {showNoIndexedState ? (
            <div className="space-y-3 px-4 py-3">
              <div>
                <p className="font-medium">No indexed plugin found.</p>
                <p className="mt-1 text-sm text-muted">
                  Check WordPress.org before starting a scan.
                </p>
              </div>
              {submissionSlug ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={checkWordPressOrg}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
                >
                  Check WordPress.org
                </button>
              ) : null}
            </div>
          ) : null}
          {lookupState.status === "checking" ? (
            <SearchStateRow
              icon={<Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              title="Checking WordPress.org"
              description={`Looking for "${submissionSlug}".`}
            />
          ) : null}
          {lookupState.status === "found" ? (
            <div className="space-y-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">Found on WordPress.org</p>
                  <p className="mt-1 truncate text-sm text-foreground">
                    {lookupState.plugin.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {lookupState.plugin.slug}
                    {lookupState.plugin.version ? ` - v${lookupState.plugin.version}` : ""}
                    {lookupState.plugin.activeInstalls !== undefined
                      ? ` - ${formatInstallCount(lookupState.plugin.activeInstalls)} installs`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => submitFromWordPress(lookupState.plugin.slug)}
                className="inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />
                ) : null}
                <span className="truncate">Scan {lookupState.plugin.name}</span>
              </button>
            </div>
          ) : null}
          {lookupState.status === "not_found" || lookupState.status === "error" ? (
            <SearchStateRow
              title={lookupState.message}
              description={
                lookupState.status === "not_found"
                  ? "Try a WordPress.org plugin slug or URL."
                  : "Search results are still available."
              }
            />
          ) : null}
          {submissionError ? (
            <div className="px-4 pb-2 pt-1 text-sm text-risk">{submissionError}</div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function SearchStateRow({
  title,
  description,
  icon,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 gap-3 px-4 ${compact ? "py-2" : "py-3"}`}>
      {icon ? <span className="mt-0.5 shrink-0 text-muted">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

function formatInstallCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return value.toLocaleString();
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
