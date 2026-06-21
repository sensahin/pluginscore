import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CompareBuilder } from "@/components/compare-builder";
import { getPlugins } from "@/lib/api";
import {
  canonicalComparePath,
  isValidComparison,
  parseComparisonQuery,
} from "@/lib/compare";
import { LOCAL_PLUGIN_SUGGESTION_LIMIT } from "@/lib/plugin-suggestions";
import { seoMetadata } from "@/lib/seo";

type ComparePageProps = {
  searchParams: Promise<{
    plugins?: string | string[];
  }>;
};

export const metadata = seoMetadata({
  title: "Compare WordPress Plugins",
  description:
    "Compare WordPress plugin scores, Plugin Check findings, installs, ratings, repository metadata, and scan history.",
  path: "/compare",
});

export const revalidate = 1_800;

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { plugins: pluginsParam } = await searchParams;
  const requestedSlugs = parseComparisonQuery(pluginsParam);

  if (isValidComparison(requestedSlugs)) {
    redirect(canonicalComparePath(requestedSlugs));
  }

  const plugins = await getPlugins({
    limit: LOCAL_PLUGIN_SUGGESTION_LIMIT,
    sort: "installs_desc",
  });

  return (
    <AppShell>
      <section className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            Compare WordPress Plugins
          </h1>
        </div>
        <CompareBuilder
          plugins={plugins.map((plugin) => ({
            slug: plugin.slug,
            name: plugin.name,
            activeInstalls: plugin.activeInstalls,
            downloads: plugin.downloads,
            rating: plugin.rating,
            ratingCount: plugin.ratingCount,
            lastUpdated: plugin.lastUpdated,
            score: plugin.score,
            audited: plugin.audited,
          }))}
          initialSlugs={requestedSlugs}
        />
      </section>
    </AppShell>
  );
}
