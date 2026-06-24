"use client";

import type { AuthorSummary } from "@pluginscore/core";
import { AlertTriangle, Download, Gauge, Package, User } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AuthorIndexSort } from "@/lib/api";
import { authorIndexSortKeys, authorIndexSorts } from "./author-index-sorts";

const publicApiBaseUrl =
  process.env.NEXT_PUBLIC_PLUGINSCORE_API_URL ?? "https://api.pluginscore.com";

type AuthorIndexViewProps = {
  initialAuthors: AuthorSummary[];
  limit: number;
};

export function AuthorIndexView({ initialAuthors, limit }: AuthorIndexViewProps) {
  const [sort, setSort] = useState<AuthorIndexSort>("installs_desc");
  const [authorLists, setAuthorLists] = useState<Partial<Record<AuthorIndexSort, AuthorSummary[]>>>({
    installs_desc: initialAuthors,
  });
  const [loadingSort, setLoadingSort] = useState<AuthorIndexSort | null>(null);
  const [errorSort, setErrorSort] = useState<AuthorIndexSort | null>(null);
  const authors = authorLists[sort] ?? [];

  async function selectSort(nextSort: AuthorIndexSort) {
    setSort(nextSort);
    setErrorSort(null);

    if (authorLists[nextSort]) {
      return;
    }

    setLoadingSort(nextSort);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        sort: nextSort,
      });
      const response = await fetch(`${publicApiBaseUrl}/authors?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to load authors: ${response.status}`);
      }

      const nextAuthors = await response.json() as AuthorSummary[];
      setAuthorLists((current) => ({
        ...current,
        [nextSort]: nextAuthors,
      }));
    } catch {
      setErrorSort(nextSort);
    } finally {
      setLoadingSort((current) => (current === nextSort ? null : current));
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="border-b border-line p-5">
        <h1 className="text-3xl font-semibold tracking-normal">
          WordPress Plugin Authors
        </h1>
        <nav className="mt-4 flex flex-wrap gap-2">
          {authorIndexSortKeys.map((sortKey) => (
            <button
              key={sortKey}
              type="button"
              onClick={() => void selectSort(sortKey)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                sortKey === sort
                  ? "border-brand/40 bg-brand/10 text-foreground"
                  : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
              }`}
            >
              {authorIndexSorts[sortKey].label}
            </button>
          ))}
        </nav>
      </div>
      <div className="divide-y divide-line">
        {authors.map((author) => {
          const authorKey = author.slug || author.name;

          return (
            <article
              key={authorKey}
              className="grid gap-4 p-4 transition hover:bg-surface-subtle lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-muted">
                  <User size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/authors/${encodeURIComponent(authorKey)}`}
                    className="block truncate font-semibold hover:text-brand"
                  >
                    {author.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {author.pluginCount.toLocaleString()} plugin
                    {author.pluginCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="min-w-0 text-sm">
                <p className="text-xs font-medium uppercase text-muted">Top plugin</p>
                {author.topPlugin ? (
                  <Link
                    href={`/plugins/${encodeURIComponent(author.topPlugin.slug)}`}
                    className="mt-1 block truncate font-medium hover:text-brand"
                  >
                    {author.topPlugin.name}
                  </Link>
                ) : (
                  <p className="mt-1 text-muted">-</p>
                )}
                {author.topPlugin ? (
                  <p className="mt-1 text-xs text-muted">
                    {author.topPlugin.activeInstalls} active installs
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted sm:grid-cols-4 lg:min-w-[28rem]">
                <AuthorMetric
                  icon={<Download size={14} aria-hidden="true" />}
                  label="Installs"
                  value={formatCompact(author.activeInstalls)}
                />
                <AuthorMetric
                  icon={<Package size={14} aria-hidden="true" />}
                  label="Audited"
                  value={author.auditedPluginCount.toLocaleString()}
                />
                <AuthorMetric
                  icon={<Gauge size={14} aria-hidden="true" />}
                  label="Avg"
                  value={author.averageScore !== undefined ? String(author.averageScore) : "-"}
                />
                <AuthorMetric
                  icon={<AlertTriangle size={14} aria-hidden="true" />}
                  label="Review"
                  value={(author.needsReviewCount ?? 0).toLocaleString()}
                />
              </div>
            </article>
          );
        })}
        {loadingSort === sort && authors.length === 0 ? (
          <div className="p-4 text-sm text-muted">Loading authors...</div>
        ) : null}
        {errorSort === sort ? (
          <div className="p-4 text-sm text-danger">Unable to load this author list.</div>
        ) : null}
      </div>
    </section>
  );
}

function AuthorMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="truncate">
        <span className="font-mono text-foreground">{value}</span> {label}
      </span>
    </span>
  );
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}
