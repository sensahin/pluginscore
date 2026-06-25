"use client";

import type { IssueOccurrence, PaginatedResult } from "@pluginscore/core";
import { ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 12;

export function IssueLocations({
  pluginSlug,
  issueCode,
  occurrenceCount,
}: {
  pluginSlug: string;
  issueCode: string;
  occurrenceCount: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PaginatedResult<IssueOccurrence> | null>(null);

  const toggle = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded && !page && !isLoading) {
      void loadPage(1);
    }
  };

  const loadMore = () => {
    if (!page?.hasNextPage || isLoading) {
      return;
    }

    void loadPage(page.page + 1);
  };

  async function loadPage(nextPage: number) {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        locationsOnly: "true",
        page: String(nextPage),
        perPage: String(PAGE_SIZE),
      });
      const response = await fetch(
        `/api/plugins/${encodeURIComponent(pluginSlug)}/issues/${encodeURIComponent(issueCode)}/occurrences?${params.toString()}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Unable to load locations");
      }

      const nextPageData = (await response.json()) as PaginatedResult<IssueOccurrence>;
      setPage((current) =>
        current && nextPage > 1
          ? {
              ...nextPageData,
              items: [...current.items, ...nextPageData.items],
            }
          : nextPageData,
      );
    } catch {
      setError("Locations could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-line bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
        aria-expanded={isExpanded}
        onClick={toggle}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <MapPin size={15} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="font-medium">Locations</span>
          <span className="text-xs text-muted">
            {occurrenceCount.toLocaleString()} occurrence{occurrenceCount === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isExpanded ? (
        <div className="border-t border-line px-3 py-3">
          {isLoading && !page ? (
            <p className="text-sm text-muted">Loading locations...</p>
          ) : error ? (
            <p className="text-sm text-risk">{error}</p>
          ) : page && page.total === 0 ? (
            <p className="text-sm text-muted">
              File locations will appear after the next scan.
            </p>
          ) : page ? (
            <div className="space-y-3">
              <ul className="divide-y divide-line rounded-md border border-line bg-background">
                {page.items.map((occurrence) => (
                  <OccurrenceRow key={occurrence.id} occurrence={occurrence} />
                ))}
              </ul>
              {page.hasNextPage ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    disabled={isLoading}
                    onClick={loadMore}
                  >
                    {isLoading ? "Loading..." : "Show more"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OccurrenceRow({ occurrence }: { occurrence: IssueOccurrence }) {
  const lineLabel =
    occurrence.line !== undefined && occurrence.line > 0
      ? `:${occurrence.line}${occurrence.column !== undefined && occurrence.column > 0 ? `:${occurrence.column}` : ""}`
      : "";

  return (
    <li className="min-w-0 px-3 py-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0 break-all font-mono text-xs text-foreground">
          {occurrence.filePath ?? "Unknown file"}
          {lineLabel}
        </span>
        <span className="shrink-0 rounded-md bg-surface-subtle px-2 py-1 text-xs text-muted">
          {occurrence.severity}
        </span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-muted">
        {occurrence.message}
      </p>
    </li>
  );
}
