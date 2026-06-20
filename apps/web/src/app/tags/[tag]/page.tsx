import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Gauge, Package, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getPluginsPage, getTag } from "@/lib/api";
import {
  canonicalPath,
  normalizePageParam,
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { plugins as samplePlugins } from "@/lib/plugin-score-data";
import { seoDisplayName, seoMetadata } from "@/lib/seo";

const tagSorts = {
  score_desc: {
    label: "Best scored",
    titleSuffix: "Best Scored",
  },
  installs_desc: {
    label: "Most installed",
    titleSuffix: "Most Installed",
  },
  scanned_desc: {
    label: "Recently scanned",
    titleSuffix: "Recently Scanned",
  },
  issues_desc: {
    label: "Most issues",
    titleSuffix: "Most Issues",
  },
} as const;

type TagSort = keyof typeof tagSorts;

type TagPageProps = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export function generateStaticParams() {
  const tags = new Set(
    samplePlugins.flatMap((plugin) => plugin.tags?.map((tag) => tag.slug) ?? []),
  );

  return [...tags].map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
  searchParams,
}: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const resolvedSearchParams = await searchParams;
  const sort = normalizeSort(resolvedSearchParams.sort);
  const page = normalizePageParam(resolvedSearchParams.page);
  const detail = await getTag(tag, sort);
  const displayName = seoDisplayName(detail?.name ?? titleFromTagSlug(tag));
  const pluginNames = detail?.plugins.slice(0, 5).map((plugin) => plugin.name) ?? [];
  const scoreText =
    detail?.averageScore !== undefined
      ? ` Average score: ${detail.averageScore}/100.`
      : "";
  const description =
    detail && detail.pluginCount > 0
      ? `${detail.pluginCount} ${displayName} WordPress plugins ranked by scores, findings, installs, and repository metadata.${scoreText}`
      : `Best ${displayName} WordPress plugins ranked by PluginScore audits, issue counts, installs, and repository metadata.`;

  return {
    ...seoMetadata({
      title: titleWithPage(`Best ${displayName} WordPress Plugins`, page),
      description,
      path: canonicalPath(`/tags/${encodeURIComponent(tag)}`, page, {
        sort: sort === "score_desc" ? undefined : sort,
      }),
    }),
    keywords: [
      displayName,
      "WordPress plugins",
      "PluginScore",
      "WordPress plugin ranking",
      ...pluginNames,
    ],
  };
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { tag } = await params;
  const resolvedSearchParams = await searchParams;
  const sort = normalizeSort(resolvedSearchParams.sort);
  const page = normalizePageParam(resolvedSearchParams.page);
  const auditedOnly = sort === "score_desc" || sort === "scanned_desc" || sort === "issues_desc";
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${detail.name} WordPress Plugins`,
    description: `${detail.pluginCount} WordPress plugin${detail.pluginCount === 1 ? "" : "s"} tagged ${detail.name} on PluginScore.`,
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
              {detail.name}
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
                href={
                  sortKey === "score_desc"
                    ? `/tags/${encodeURIComponent(detail.slug)}`
                    : `/tags/${encodeURIComponent(detail.slug)}?sort=${sortKey}`
                }
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
          basePath={`/tags/${encodeURIComponent(detail.slug)}`}
          page={plugins.page}
          perPage={plugins.perPage}
          total={plugins.total}
          totalPages={plugins.totalPages}
          searchParams={{ sort: sort === "score_desc" ? undefined : sort }}
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

function normalizeSort(value?: string): TagSort {
  return value && value in tagSorts ? (value as TagSort) : "score_desc";
}

function titleFromTagSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}
