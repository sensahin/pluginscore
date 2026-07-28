import type { MetadataRoute } from "next";
import {
  getAuthors,
  getExternalDomains,
  getIssues,
  getPopularComparisons,
  getSitemapPlugins,
  getTags,
} from "@/lib/api";
import { canonicalComparePath } from "@/lib/compare";
import { FEATURED_COMPARISON_SLUGS } from "@/lib/featured-comparisons";
import { slugifyLabel } from "@/lib/route-utils";

export const revalidate = 3_600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [authors, tags, domains, issues, sitemapPlugins, comparisons] = await Promise.all([
    getAuthors(500),
    getTags(500, 1),
    getExternalDomains(500, 1),
    getIssues(),
    getSitemapPlugins(),
    getPopularComparisons({
      limit: 50,
      days: 30,
      pluginCount: 2,
      minimumCount: 2,
    }),
  ]);
  const rankingRoutes = [
    "/rankings/best",
    "/rankings/worst",
    "/rankings/most-installed",
    "/rankings/most-downloaded",
    "/rankings/new-popular",
    "/rankings/most-issues",
    "/rankings/most-improved",
    "/rankings/recently-updated",
  ];
  const categoryRoutes = [
    ...new Set(issues.map((issue) => `/categories/${slugifyLabel(issue.family)}`)),
  ];
  const routes = [
    "",
    "/about",
    "/authors",
    "/compare",
    "/domains",
    "/issues",
    "/rankings",
    "/tags",
    "/methodology",
    ...rankingRoutes,
    ...categoryRoutes,
  ].map((path) => ({
    url: `https://pluginscore.com${path}`,
  }));

  const pluginRoutes = sitemapPlugins.map((plugin) => ({
    url: `https://pluginscore.com/plugins/${encodeURIComponent(plugin.slug)}`,
    lastModified: validDate(plugin.updatedAt),
  }));

  const issueRoutes = issues.map((issue) => ({
    url: `https://pluginscore.com/issues/${encodeURIComponent(issue.code)}`,
  }));

  const authorRoutes = authors.map((author) => ({
    url: `https://pluginscore.com/authors/${encodeURIComponent(author.slug || author.name)}`,
  }));

  const tagRoutes = tags.map((tag) => ({
    url: `https://pluginscore.com/tags/${encodeURIComponent(tag.slug)}`,
  }));

  const domainRoutes = domains
    .filter((domain) => !domain.platformReference)
    .map((domain) => ({
      url: `https://pluginscore.com/domains/${encodeURIComponent(domain.domain)}`,
      lastModified: validDate(domain.lastSeenAt),
    }));

  const featuredComparisonPaths = new Set(
    FEATURED_COMPARISON_SLUGS.map((slugs) =>
      canonicalComparePath([...slugs]),
    ),
  );
  const comparisonRoutes = [
    ...[...featuredComparisonPaths].map((path) => ({
      url: `https://pluginscore.com${path}`,
    })),
    ...comparisons.flatMap((comparison) => {
      const path = canonicalComparePath(comparison.pluginSlugs);

      return featuredComparisonPaths.has(path)
        ? []
        : [{
            url: `https://pluginscore.com${path}`,
            lastModified: validDate(comparison.lastComparedAt),
          }];
    }),
  ];

  return [
    ...routes,
    ...pluginRoutes,
    ...issueRoutes,
    ...authorRoutes,
    ...tagRoutes,
    ...domainRoutes,
    ...comparisonRoutes,
  ];
}

function validDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
