import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Gauge, Package, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getPluginsPage, getTag, getTags } from "@/lib/api";
import {
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { seoDisplayName, seoMetadata } from "@/lib/seo";

export const tagSorts = {
  score_desc: {
    label: "Top Scores",
    titleSuffix: "Top Scores",
    segment: "",
  },
  score_asc: {
    label: "Needs Review",
    titleSuffix: "Needs Review",
    segment: "needs-review",
  },
  installs_desc: {
    label: "Most Installed",
    titleSuffix: "Most Installed",
    segment: "most-installed",
  },
  downloads_desc: {
    label: "Most Downloaded",
    titleSuffix: "Most Downloaded",
    segment: "most-downloaded",
  },
  new_popular_desc: {
    label: "New & Popular",
    titleSuffix: "New & Popular",
    segment: "new-popular",
  },
  issues_desc: {
    label: "Most Issues",
    titleSuffix: "Most Issues",
    segment: "most-issues",
  },
  delta_desc: {
    label: "Most Improved",
    titleSuffix: "Most Improved",
    segment: "most-improved",
  },
  scanned_desc: {
    label: "Recently Scanned",
    titleSuffix: "Recently Scanned",
    segment: "recently-scanned",
  },
} as const;

export type TagSort = keyof typeof tagSorts;

type TagPageViewProps = {
  tag: string;
  sort?: TagSort;
  page?: number;
};

const STATIC_TAG_LIMIT = 100;

const tagSortBySegment = Object.fromEntries(
  (Object.keys(tagSorts) as TagSort[]).map((sort) => [
    tagSorts[sort].segment,
    sort,
  ]),
) as Record<string, TagSort>;

export async function generateTagStaticParams() {
  const tags = await getTags(STATIC_TAG_LIMIT, 1);
  return tags.map((tag) => ({ tag: tag.slug }));
}

export async function generateTagSortStaticParams() {
  const tags = await getTags(STATIC_TAG_LIMIT, 1);
  const sortSegments = (Object.keys(tagSorts) as TagSort[])
    .filter((sort) => sort !== "score_desc")
    .map((sort) => tagSorts[sort].segment);

  return tags.flatMap((tag) =>
    sortSegments.map((sort) => ({
      tag: tag.slug,
      sort,
    })),
  );
}

export function tagSortFromSegment(segment: string) {
  const sort = tagSortBySegment[segment];
  return sort && sort !== "score_desc" ? sort : null;
}

export function tagSortPath(tag: string, sort: TagSort = "score_desc", page = 1) {
  const encodedTag = encodeURIComponent(tag);
  const sortSegment = tagSorts[sort].segment;
  const basePath = sortSegment
    ? `/tags/${encodedTag}/${sortSegment}`
    : `/tags/${encodedTag}`;

  return page > 1 ? `${basePath}/page/${page}` : basePath;
}

export async function generateTagMetadata({
  tag,
  sort = "score_desc",
  page = 1,
}: TagPageViewProps): Promise<Metadata> {
  const detail = await getTag(tag, sort);
  const displayName = seoDisplayName(detail?.name ?? titleFromTagSlug(tag));
  const pluginNames = detail?.plugins.slice(0, 5).map((plugin) => plugin.name) ?? [];
  const scoreText =
    detail?.averageScore !== undefined
      ? ` Average score: ${detail.averageScore}/100.`
      : "";
  const description =
    detail && detail.pluginCount > 0
      ? `Compare ${detail.pluginCount.toLocaleString()} ${displayName} WordPress plugins by audit score, Plugin Check findings, issue counts, installs, ratings, and update activity.${scoreText}`
      : `Compare ${displayName} WordPress plugins by audit score, Plugin Check findings, issue counts, installs, ratings, and update activity.`;
  const title = tagSeoTitle(displayName, sort);

  return {
    ...seoMetadata({
      title: titleWithPage(title, page),
      description,
      path: tagSortPath(detail?.slug ?? tag, sort, page),
    }),
    keywords: [
      displayName,
      "WordPress plugins",
      "PluginScore",
      "WordPress plugin audit score",
      "Plugin Check findings",
      "WordPress plugin security signals",
      "WordPress plugin ranking",
      ...pluginNames,
    ],
  };
}

export async function TagPageView({
  tag,
  sort = "score_desc",
  page = 1,
}: TagPageViewProps) {
  const auditedOnly =
    sort === "score_desc" ||
    sort === "score_asc" ||
    sort === "scanned_desc" ||
    sort === "issues_desc" ||
    sort === "delta_desc";
  const [detail, plugins] = await Promise.all([
    getTag(tag, sort, 10),
    getPluginsPage({
      page,
      perPage: PLUGIN_DIRECTORY_PER_PAGE,
      sort,
      audited: auditedOnly,
      tag,
    }),
  ]);

  if (!detail) {
    notFound();
  }

  const rankOffset = (plugins.page - 1) * plugins.perPage;
  const displayName = seoDisplayName(detail.name);
  const pageTitle = tagPageTitle(displayName, sort);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageTitle,
    description: `Compare ${displayName} WordPress plugins by PluginScore audit score, Plugin Check findings, installs, ratings, and repository metadata.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: plugins.total,
      itemListElement: plugins.items.slice(0, 10).map((plugin, index) => ({
        "@type": "ListItem",
        position: rankOffset + index + 1,
        item: {
          "@type": "SoftwareApplication",
          name: plugin.name,
          applicationCategory: "WordPress plugin",
          operatingSystem: "WordPress",
          url: `https://pluginscore.com/plugins/${encodeURIComponent(plugin.slug)}`,
          softwareVersion: plugin.version,
          aggregateRating: plugin.audited
            ? {
                "@type": "AggregateRating",
                ratingValue: plugin.score,
                bestRating: 100,
                worstRating: 0,
              }
            : undefined,
        },
      })),
    },
  };

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-muted">
            <Tag size={26} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              {pageTitle}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {detail.pluginCount.toLocaleString()} indexed plugin
              {detail.pluginCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TagStat
          label="Plugins"
          value={detail.pluginCount.toLocaleString()}
          icon={<Package size={18} aria-hidden="true" />}
        />
        <TagStat
          label="Active Installs"
          value={formatCompact(detail.activeInstalls)}
          icon={<Download size={18} aria-hidden="true" />}
        />
        <TagStat
          label="Average Score"
          value={detail.averageScore !== undefined ? String(detail.averageScore) : "-"}
          icon={<Gauge size={18} aria-hidden="true" />}
        />
        <TagStat
          label="Audited"
          value={detail.auditedPluginCount.toLocaleString()}
          icon={<Tag size={18} aria-hidden="true" />}
        />
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold">{tagSorts[sort].titleSuffix}</h2>
          <nav className="flex flex-wrap gap-2">
            {(Object.keys(tagSorts) as TagSort[]).map((sortKey) => (
              <Link
                key={sortKey}
                href={tagSortPath(detail.slug, sortKey)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  sortKey === sort
                    ? "border-brand/40 bg-brand/10 text-foreground"
                    : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {tagSorts[sortKey].label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-5">
          <PluginListTable plugins={plugins.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={tagSortPath(detail.slug, sort)}
          page={plugins.page}
          perPage={plugins.perPage}
          total={plugins.total}
          totalPages={plugins.totalPages}
          hrefForPage={(targetPage) => tagSortPath(detail.slug, sort, targetPage)}
        />
      </section>
    </AppShell>
  );
}

function TagStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-muted">{label}</p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}

function titleFromTagSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function tagSeoTitle(displayName: string, sort: TagSort) {
  if (sort === "score_desc") {
    return `Top ${displayName} WordPress Plugins by Audit Score`;
  }

  return tagPageTitle(displayName, sort);
}

function tagPageTitle(displayName: string, sort: TagSort) {
  if (sort === "score_desc") {
    return `Top ${displayName} WordPress Plugins`;
  }

  if (sort === "score_asc") {
    return `${displayName} WordPress Plugins That Need Review`;
  }

  if (sort === "issues_desc") {
    return `${displayName} WordPress Plugins with Most Issues`;
  }

  if (sort === "new_popular_desc") {
    return `New & Popular ${displayName} WordPress Plugins`;
  }

  return `${tagSorts[sort].titleSuffix} ${displayName} WordPress Plugins`;
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}
