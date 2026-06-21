import {
  ArrowDownRight,
  ArrowUpRight,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PluginHighlightList } from "@/components/plugin-highlight-list";
import { PluginIcon } from "@/components/plugin-icon";
import { PluginSearch } from "@/components/plugin-search";
import { PluginTabbedList } from "@/components/plugin-tabbed-list";
import { TagChips } from "@/components/tag-chips";
import { getPlugins, getTags } from "@/lib/api";
import {
  scoreDelta,
  type PluginSummary,
  type TagSummary,
} from "@/lib/plugin-score-data";
import { LOCAL_PLUGIN_SUGGESTION_LIMIT } from "@/lib/plugin-suggestions";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "WordPress Plugin Audit Scores | PluginScore",
  description:
    "Search WordPress plugin audit scores, Plugin Check findings, issue counts, rankings, categories, authors, installs, and repository metadata.",
  path: "/",
  absoluteTitle: true,
});

export const revalidate = 1_800;

export default async function Home() {
  const [
    searchPlugins,
    bestScored,
    mostInstalled,
    recentlyScanned,
    mostIssues,
    needsReview,
    popularCategories,
  ] = await Promise.all([
    getPlugins({ limit: LOCAL_PLUGIN_SUGGESTION_LIMIT, sort: "installs_desc" }),
    getPlugins({ limit: 12, sort: "score_desc", audited: true }),
    getPlugins({ limit: 12, sort: "installs_desc" }),
    getPlugins({ limit: 12, sort: "scanned_desc", audited: true }),
    getPlugins({ limit: 12, sort: "issues_desc", audited: true }),
    getPlugins({ limit: 5, sort: "score_asc", audited: true }),
    getTags(12, 3),
  ]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-4xl space-y-5 pt-2 text-center">
        <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
          WordPress Plugin Scores
        </h1>
        <PluginSearch
          plugins={searchPlugins.map((plugin) => ({
            slug: plugin.slug,
            name: plugin.name,
            activeInstalls: plugin.activeInstalls,
            downloads: plugin.downloads,
            lastUpdated: plugin.lastUpdated,
            rating: plugin.rating,
            ratingCount: plugin.ratingCount,
            score: plugin.score,
            audited: plugin.audited,
          }))}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Popular Categories</h2>
          <Link
            href="/tags"
            className="text-sm font-medium text-brand hover:text-brand-strong"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popularCategories.slice(0, 8).map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Recently Scanned</h2>
          <Link
            href="/rankings/recently-updated"
            className="text-sm font-medium text-brand hover:text-brand-strong"
          >
            View latest
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentlyScanned.slice(0, 6).map((plugin) => (
            <PluginCard key={plugin.slug} plugin={plugin} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PluginHighlightList
          title="Top Scores"
          plugins={bestScored.slice(0, 5)}
          viewAllHref="/rankings/best"
        />
        <PluginHighlightList
          title="Needs Review"
          plugins={needsReview}
          viewAllHref="/rankings/worst"
        />
      </section>

      <PluginTabbedList
        title="Browse Plugins"
        tabs={[
          { id: "best", label: "Best scored", plugins: bestScored },
          { id: "installed", label: "Most installed", plugins: mostInstalled },
          { id: "scanned", label: "Recently scanned", plugins: recentlyScanned },
          { id: "issues", label: "Most issues", plugins: mostIssues },
        ]}
      />
    </AppShell>
  );
}

function CategoryCard({ category }: { category: TagSummary }) {
  return (
    <Link
      href={`/tags/${encodeURIComponent(category.slug)}`}
      className="group flex min-w-0 items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-subtle"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-muted group-hover:text-foreground">
          <Tag size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-info group-hover:underline">
            {category.name}
          </h3>
          <p className="mt-1 truncate text-xs text-muted">
            {category.auditedPluginCount.toLocaleString()} audited -{" "}
            {formatCompact(category.activeInstalls)} installs
          </p>
        </div>
      </div>
      {category.averageScore !== undefined ? (
        <span className="inline-flex shrink-0 items-baseline gap-1 text-xs font-semibold text-foreground">
          <span className="font-mono text-sm">{category.averageScore}</span>
          avg
        </span>
      ) : null}
    </Link>
  );
}

function PluginCard({ plugin }: { plugin: PluginSummary }) {
  const delta = scoreDelta(plugin);
  const DeltaIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="group relative flex min-h-60 min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-md border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:shadow">
      <Link
        href={`/plugins/${plugin.slug}`}
        prefetch={false}
        className="absolute inset-0 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={`Open ${plugin.name}`}
      />
      <div className="flex min-w-0 items-start justify-between gap-4">
        <PluginIcon plugin={plugin} size="xl" />
        <ScoreCircle score={plugin.score} band={plugin.band} />
      </div>
      <div className="mt-5 min-w-0">
        <span className="line-clamp-2 text-lg font-semibold leading-6 text-info">
          {plugin.name}
        </span>
        <p className="mt-2 text-sm text-muted">{plugin.activeInstalls} active installs</p>
      </div>
      <div className="mt-auto pt-4">
        <div className="pointer-events-none relative z-20 min-h-7 [&_a]:pointer-events-auto">
          <TagChips tags={plugin.tags} limit={3} size="xs" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
          <span>{plugin.findings.toLocaleString()} findings</span>
          <span
            className={`inline-flex items-center gap-1 font-mono ${
              delta >= 0 ? "text-good" : "text-risk"
            }`}
          >
            <DeltaIcon size={14} aria-hidden="true" />
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        </div>
      </div>
    </article>
  );
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}

const scoreCircleClassName: Record<PluginSummary["band"], string> = {
  excellent: "border-good/30 bg-good/10 text-good",
  good: "border-info/30 bg-info/10 text-info",
  watch: "border-warn/30 bg-warn/10 text-warn",
  risk: "border-risk/30 bg-risk/10 text-risk",
};

function ScoreCircle({
  score,
  band,
}: Pick<PluginSummary, "score" | "band">) {
  return (
    <div
      className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-full border-2 font-semibold ${scoreCircleClassName[band]}`}
      aria-label={`Score ${Math.floor(score)} out of 100`}
    >
      <span className="font-mono text-xl leading-none">{Math.floor(score)}</span>
      <span className="mt-0.5 text-[10px] uppercase leading-none text-muted">
        Score
      </span>
    </div>
  );
}
