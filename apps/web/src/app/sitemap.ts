import type { MetadataRoute } from "next";
import { getAuthors, getExternalDomainFamilies, getTags } from "@/lib/api";
import { issues, plugins } from "@/lib/plugin-score-data";
import { slugifyLabel } from "@/lib/route-utils";

export const revalidate = 3_600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [authors, tags, domainFamilies] = await Promise.all([
    getAuthors(150),
    getTags(150, 3),
    getExternalDomainFamilies(150, 3),
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

  const pluginRoutes = plugins.map((plugin) => ({
    url: `https://pluginscore.com/plugins/${plugin.slug}`,
    lastModified: new Date(plugin.lastUpdated),
  }));

  const issueRoutes = issues.map((issue) => ({
    url: `https://pluginscore.com/issues/${encodeURIComponent(issue.code)}`,
    lastModified: now,
  }));

  const authorRoutes = authors.flatMap((author) => {
    const authorPath = `/authors/${encodeURIComponent(author.name)}`;

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

  const domainRoutes = domainFamilies
    .filter((family) => family.classification === "standard" && !family.platformReference)
    .flatMap((family) => {
      const routes = [
        {
          url: `https://pluginscore.com/domains/${encodeURIComponent(family.rootDomain)}`,
          lastModified: family.lastSeenAt ? new Date(family.lastSeenAt) : now,
        },
      ];

      for (const domain of family.domains.slice(0, 3)) {
        if (domain.domain === family.rootDomain || domain.classification !== "standard") {
          continue;
        }

        routes.push({
          url: `https://pluginscore.com/domains/${encodeURIComponent(domain.domain)}`,
          lastModified: domain.lastSeenAt ? new Date(domain.lastSeenAt) : now,
        });
      }

      return routes;
    });

  return [
    ...routes,
    ...pluginRoutes,
    ...issueRoutes,
    ...authorRoutes,
    ...tagRoutes,
    ...domainRoutes,
  ];
}
