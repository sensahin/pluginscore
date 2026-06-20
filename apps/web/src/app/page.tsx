import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PluginHighlightList } from "@/components/plugin-highlight-list";
import { PluginIcon } from "@/components/plugin-icon";
import { PluginSearch } from "@/components/plugin-search";
import { PluginTabbedList } from "@/components/plugin-tabbed-list";
import { TagChips } from "@/components/tag-chips";
import { getPlugins } from "@/lib/api";
import { scoreDelta, type PluginSummary } from "@/lib/plugin-score-data";
import { LOCAL_PLUGIN_SUGGESTION_LIMIT } from "@/lib/plugin-suggestions";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "WordPress Plugin Scores | PluginScore",
  description:
    "Search WordPress plugin scores, Plugin Check findings, issue counts, rankings, tags, authors, installs, and repository metadata.",
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
  ] = await Promise.all([
    getPlugins({ limit: LOCAL_PLUGIN_SUGGESTION_LIMIT, sort: "installs_desc" }),
    getPlugins({ limit: 12, sort: "score_desc", audited: true }),
    getPlugins({ limit: 12, sort: "installs_desc" }),
    getPlugins({ limit: 12, sort: "scanned_desc", audited: true }),
    getPlugins({ limit: 12, sort: "issues_desc", audited: true }),
    getPlugins({ limit: 5, sort: "score_asc", audited: true }),
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
          }))}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Recently Scanned</h2>
          <Link
            href="/rankings/recently-updated"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
          >
            <CalendarClock size={16} aria-hidden="true" />
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

function PluginCard({ plugin }: { plugin: PluginSummary }) {
  const delta = scoreDelta(plugin);
  const DeltaIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="flex min-h-60 min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:shadow">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <PluginIcon plugin={plugin} size="xl" />
        <ScoreCircle score={plugin.score} band={plugin.band} />
      </div>
      <div className="mt-5 min-w-0">
        <Link
          href={`/plugins/${plugin.slug}`}
          prefetch={false}
          className="line-clamp-2 text-lg font-semibold leading-6 text-info hover:underline"
        >
          {plugin.name}
        </Link>
        <p className="mt-2 text-sm text-muted">{plugin.activeInstalls} active installs</p>
      </div>
      <div className="mt-auto pt-4">
        <div className="min-h-7">
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
