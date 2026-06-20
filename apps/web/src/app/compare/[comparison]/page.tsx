import type { PluginDetail } from "@pluginscore/core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPlugin, getPluginScoreHistory } from "@/lib/api";
import {
  canonicalComparePath,
  isValidComparison,
  parseComparisonPath,
} from "@/lib/compare";
import { seoMetadata, truncateText } from "@/lib/seo";
import {
  comparisonChartColors,
  ComparisonPageView,
  pluginDisplayName,
  type ComparisonEntry,
} from "./comparison-page-view";

type CompareRouteProps = {
  params: Promise<{
    comparison: string;
  }>;
};

export const revalidate = 1_800;

export async function generateMetadata({
  params,
}: CompareRouteProps): Promise<Metadata> {
  const { comparison } = await params;
  const slugs = parseComparisonPath(comparison);

  if (!isValidComparison(slugs)) {
    return seoMetadata({
      title: "Compare WordPress Plugins",
      description:
        "Compare WordPress plugin scores, Plugin Check findings, installs, ratings, repository metadata, and scan history.",
      path: "/compare",
    });
  }

  const plugins = await Promise.all(slugs.map((slug) => getPlugin(slug)));
  const foundPlugins = plugins.filter((plugin): plugin is PluginDetail => Boolean(plugin));

  if (foundPlugins.length !== slugs.length) {
    return {
      ...seoMetadata({
        title: "Compare WordPress Plugins",
        description:
          "Compare WordPress plugin scores, Plugin Check findings, installs, ratings, repository metadata, and scan history.",
        path: canonicalComparePath(slugs),
      }),
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const names = foundPlugins.map(pluginDisplayName);
  const title = truncateText(names.join(" vs "), 72);

  return seoMetadata({
    title,
    description: `Compare WordPress plugin scores, security findings, repository metadata, ratings, installs, and scan history for ${truncateText(names.join(", "), 100)}.`,
    path: canonicalComparePath(slugs),
  });
}

export default async function CompareRoutePage({ params }: CompareRouteProps) {
  const { comparison } = await params;
  const slugs = parseComparisonPath(comparison);

  if (!isValidComparison(slugs)) {
    notFound();
  }

  const canonicalPath = canonicalComparePath(slugs);
  if (canonicalPath !== `/compare/${comparison}`) {
    redirect(canonicalPath);
  }

  const rawEntries = await Promise.all(
    slugs.map(async (slug) => {
      const [plugin, history] = await Promise.all([
        getPlugin(slug),
        getPluginScoreHistory(slug, 12),
      ]);

      return plugin
        ? {
            plugin,
            history: history?.history ?? [],
          }
        : null;
    }),
  );
  const entries = rawEntries
    .filter((entry): entry is Omit<ComparisonEntry, "color"> => Boolean(entry))
    .map((entry, index) => ({
      ...entry,
      color: comparisonChartColors[index % comparisonChartColors.length] ?? "var(--brand)",
    }));

  if (entries.length !== slugs.length) {
    notFound();
  }

  return <ComparisonPageView entries={entries} />;
}
