import { ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { PluginSearch } from "@/components/plugin-search";
import { PluginSubmissionAction } from "@/components/plugin-submission-action";
import { getPlugins, getPluginsPage } from "@/lib/api";
import { normalizePageParam, PLUGIN_DIRECTORY_PER_PAGE } from "@/lib/pagination";
import type { PluginSummary } from "@/lib/plugin-score-data";
import { LOCAL_PLUGIN_SUGGESTION_LIMIT } from "@/lib/plugin-suggestions";
import { seoMetadata } from "@/lib/seo";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export const metadata = {
  ...seoMetadata({
    title: "Search WordPress Plugins",
    description:
      "Search indexed WordPress plugin scores, Plugin Check findings, installs, authors, tags, and repository metadata.",
    path: "/search",
  }),
  robots: {
    index: false,
    follow: true,
  },
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const page = normalizePageParam(pageParam);
  const [results, suggestions] = await Promise.all([
    query
      ? getPluginsPage({
          page,
          perPage: PLUGIN_DIRECTORY_PER_PAGE,
          sort: "relevance_desc",
          query,
        })
      : Promise.resolve(null),
    getPlugins({ limit: LOCAL_PLUGIN_SUGGESTION_LIMIT, sort: "installs_desc" }),
  ]);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-semibold tracking-normal">Search</h1>
        </div>
        <div className="mt-5">
          <PluginSearch
            initialQuery={query}
            plugins={suggestions.map((plugin) => ({
              slug: plugin.slug,
              name: plugin.name,
              activeInstalls: plugin.activeInstalls,
              downloads: plugin.downloads,
              lastUpdated: plugin.lastUpdated,
              rating: plugin.rating,
              ratingCount: plugin.ratingCount,
              score: plugin.score,
            }))}
          />
        </div>
      </section>

      {query ? (
        <SearchResults query={query} result={results} />
      ) : (
        <EmptySearch plugins={suggestions.slice(0, 6)} />
      )}
    </AppShell>
  );
}

function SearchResults({
  query,
  result,
}: {
  query: string;
  result: Awaited<ReturnType<typeof getPluginsPage>> | null;
}) {
  const plugins = result?.items ?? [];

  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex flex-col gap-2 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Search Results</h2>
          <p className="mt-1 text-sm text-muted">
            {(result?.total ?? 0).toLocaleString()}{" "}
            {result?.total === 1 ? "result" : "results"} for{" "}
            <span className="font-medium text-foreground">{query}</span>.
          </p>
        </div>
        <Link
          href="/rankings"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
        >
          Rankings
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {plugins.length > 0 ? (
        <div className="p-5">
          <PluginListTable plugins={plugins} showRank={false} />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 p-5">
          <SearchX size={22} className="text-muted" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">No indexed plugin matched that search.</h3>
          </div>
          <PluginSubmissionAction input={query} />
        </div>
      )}
      {result ? (
        <PaginationControls
          basePath="/search"
          page={result.page}
          perPage={result.perPage}
          total={result.total}
          totalPages={result.totalPages}
          searchParams={{ q: query }}
        />
      ) : null}
    </section>
  );
}

function EmptySearch({ plugins }: { plugins: PluginSummary[] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Popular Plugins</h2>
      </div>
      <PluginListTable plugins={plugins} showRank={false} />
    </section>
  );
}
