import type { MetadataRoute } from "next";
import { getAuthors, getTags } from "@/lib/api";
import { issues, plugins } from "@/lib/plugin-score-data";
import { slugifyLabel } from "@/lib/route-utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [authors, tags] = await Promise.all([
    getAuthors(500),
    getTags(500, 3),
  ]);
  const rankingRoutes = [
    "/rankings/best",
    "/rankings/worst",
    "/rankings/most-installed",
    "/rankings/most-downloaded",
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

  const pluginRoutes = plugins.map((plugin) => ({
    url: `https://pluginscore.com/plugins/${plugin.slug}`,
    lastModified: new Date(plugin.lastUpdated),
  }));

  const issueRoutes = issues.map((issue) => ({
    url: `https://pluginscore.com/issues/${encodeURIComponent(issue.code)}`,
    lastModified: now,
  }));

  const authorRoutes = authors.map((author) => ({
    url: `https://pluginscore.com/authors/${encodeURIComponent(author.name)}`,
    lastModified: now,
  }));

  const tagRoutes = tags.map((tag) => ({
    url: `https://pluginscore.com/tags/${encodeURIComponent(tag.slug)}`,
    lastModified: now,
  }));

  return [...routes, ...pluginRoutes, ...issueRoutes, ...authorRoutes, ...tagRoutes];
}
