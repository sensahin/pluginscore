import type { MetadataRoute } from "next";
import {
  getAuthors,
  getExternalDomains,
  getIssues,
  getSitemapPlugins,
  getTags,
} from "@/lib/api";
import { slugifyLabel } from "@/lib/route-utils";

export const revalidate = 3_600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [authors, tags, domains, issues, sitemapPlugins] = await Promise.all([
    getAuthors(500),
    getTags(500, 1),
    getExternalDomains(500, 1),
    getIssues(),
    getSitemapPlugins(),
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
  const tagSortSegments = [
    "needs-review",
    "most-installed",
    "most-downloaded",
    "new-popular",
    "most-issues",
    "most-improved",
    "recently-scanned",
  ];
  const authorSortSegments = tagSortSegments;
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
    lastModified: now,
  }));

  const pluginRoutes = sitemapPlugins.map((plugin) => ({
    url: `https://pluginscore.com/plugins/${encodeURIComponent(plugin.slug)}`,
    lastModified: dateOrFallback(plugin.updatedAt, now),
  }));

  const issueRoutes = issues.map((issue) => ({
    url: `https://pluginscore.com/issues/${encodeURIComponent(issue.code)}`,
    lastModified: now,
  }));

  const authorRoutes = authors.flatMap((author) => {
    const authorPath = `/authors/${encodeURIComponent(author.slug || author.name)}`;

    return [
      {
        url: `https://pluginscore.com${authorPath}`,
        lastModified: now,
      },
      ...authorSortSegments.map((segment) => ({
        url: `https://pluginscore.com${authorPath}/${segment}`,
        lastModified: now,
      })),
    ];
  });

  const tagRoutes = tags.flatMap((tag) => {
    const tagPath = `/tags/${encodeURIComponent(tag.slug)}`;

    return [
      {
        url: `https://pluginscore.com${tagPath}`,
        lastModified: now,
      },
      ...tagSortSegments.map((segment) => ({
        url: `https://pluginscore.com${tagPath}/${segment}`,
        lastModified: now,
      })),
    ];
  });

  const domainRoutes = domains
    .filter((domain) => !domain.platformReference)
    .map((domain) => ({
      url: `https://pluginscore.com/domains/${encodeURIComponent(domain.domain)}`,
      lastModified: domain.lastSeenAt ? new Date(domain.lastSeenAt) : now,
    }));

  return [
    ...routes,
    ...pluginRoutes,
    ...issueRoutes,
    ...authorRoutes,
    ...tagRoutes,
    ...domainRoutes,
  ];
}

function dateOrFallback(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}
