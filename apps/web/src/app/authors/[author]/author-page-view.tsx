import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Download, Gauge, Package, User } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getAuthor, getAuthors, getPluginsPage } from "@/lib/api";
import {
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { seoMetadata } from "@/lib/seo";

export const authorSorts = {
  score_desc: {
    label: "Best scored",
    title: "Best Scored",
    segment: "",
  },
  installs_desc: {
    label: "Most installed",
    title: "Most Installed",
    segment: "most-installed",
  },
  scanned_desc: {
    label: "Recently scanned",
    title: "Recently Scanned",
    segment: "recently-scanned",
  },
  issues_desc: {
    label: "Most issues",
    title: "Most Issues",
    segment: "most-issues",
  },
} as const;

export type AuthorSort = keyof typeof authorSorts;

type AuthorPageViewProps = {
  author: string;
  sort?: AuthorSort;
  page?: number;
};

const STATIC_AUTHOR_LIMIT = 100;

const authorSortBySegment = Object.fromEntries(
  (Object.keys(authorSorts) as AuthorSort[]).map((sort) => [
    authorSorts[sort].segment,
    sort,
  ]),
) as Record<string, AuthorSort>;

export async function generateAuthorStaticParams() {
  const authors = await getAuthors(STATIC_AUTHOR_LIMIT);
  return authors.map((author) => ({ author: author.name }));
}

export async function generateAuthorSortStaticParams() {
  const authors = await getAuthors(STATIC_AUTHOR_LIMIT);
  const sortSegments = (Object.keys(authorSorts) as AuthorSort[])
    .filter((sort) => sort !== "score_desc")
    .map((sort) => authorSorts[sort].segment);

  return authors.flatMap((author) =>
    sortSegments.map((sort) => ({
      author: author.name,
      sort,
    })),
  );
}

export function authorSortFromSegment(segment: string) {
  const sort = authorSortBySegment[segment];
  return sort && sort !== "score_desc" ? sort : null;
}

export function authorSortPath(
  authorName: string,
  sort: AuthorSort = "score_desc",
  page = 1,
) {
  const encodedAuthor = encodeURIComponent(authorName);
  const sortSegment = authorSorts[sort].segment;
  const basePath = sortSegment
    ? `/authors/${encodedAuthor}/${sortSegment}`
    : `/authors/${encodedAuthor}`;

  return page > 1 ? `${basePath}/page/${page}` : basePath;
}

export async function generateAuthorMetadata({
  author,
  sort = "score_desc",
  page = 1,
}: AuthorPageViewProps): Promise<Metadata> {
  const decoded = decodeURIComponent(author);
  const detail = await getAuthor(decoded);
  const displayName = detail?.name ?? decoded;
  const pluginNames = detail?.plugins.slice(0, 5).map((plugin) => plugin.name) ?? [];
  const scoreText =
    detail?.averageScore !== undefined
      ? `, average score ${detail.averageScore}/100`
      : "";
  const installText =
    detail && detail.activeInstalls > 0
      ? `, ${formatCompact(detail.activeInstalls)} active installs`
      : "";
  const description =
    detail && detail.pluginCount > 0
      ? `${displayName} WordPress plugins: ${detail.pluginCount} indexed plugin${detail.pluginCount === 1 ? "" : "s"}${installText}${scoreText}. See audits, findings, downloads, and metadata.`
      : `Browse WordPress plugins by ${displayName}, including PluginScore audit results, findings, installs, downloads, and repository metadata.`;
  const title =
    sort === "score_desc"
      ? `${displayName} WordPress Plugins`
      : `${displayName} ${authorSorts[sort].title} WordPress Plugins`;

  return {
    ...seoMetadata({
      title: titleWithPage(title, page),
      description,
      path: authorSortPath(displayName, sort, page),
    }),
    keywords: [
      displayName,
      "WordPress plugin author",
      "WordPress plugin developer",
      "PluginScore",
      ...pluginNames,
    ],
    authors: [{ name: displayName }],
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function AuthorPageView({
  author,
  sort = "score_desc",
  page = 1,
}: AuthorPageViewProps) {
  const decoded = decodeURIComponent(author);
  const detail = await getAuthor(decoded);

  if (!detail) {
    notFound();
  }

  const auditedOnly =
    sort === "score_desc" || sort === "scanned_desc" || sort === "issues_desc";
  const plugins = await getPluginsPage({
    page,
    perPage: PLUGIN_DIRECTORY_PER_PAGE,
    sort,
    audited: auditedOnly,
    author: detail.name,
  });
  const rankOffset = (plugins.page - 1) * plugins.perPage;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Organization",
      name: detail.name,
      description: `WordPress plugin author with ${detail.pluginCount} indexed plugin${detail.pluginCount === 1 ? "" : "s"} on PluginScore.`,
      mainEntityOfPage: {
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
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: plugin.score,
              bestRating: 100,
              worstRating: 0,
            },
          },
        })),
      },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://pluginscore.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Authors",
          item: "https://pluginscore.com/authors",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: detail.name,
          item: `https://pluginscore.com/authors/${encodeURIComponent(detail.name)}`,
        },
      ],
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
            <User size={26} aria-hidden="true" />
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
        <AuthorStat
          label="Plugins"
          value={detail.pluginCount.toLocaleString()}
          icon={<Package size={18} aria-hidden="true" />}
        />
        <AuthorStat
          label="Active Installs"
          value={formatCompact(detail.activeInstalls)}
          icon={<Download size={18} aria-hidden="true" />}
        />
        <AuthorStat
          label="Average Score"
          value={detail.averageScore !== undefined ? String(detail.averageScore) : "-"}
          icon={<Gauge size={18} aria-hidden="true" />}
        />
        <AuthorStat
          label="Findings"
          value={formatCompact(detail.totalFindings)}
          icon={<AlertTriangle size={18} aria-hidden="true" />}
        />
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold">{authorSorts[sort].title}</h2>
          <nav className="flex flex-wrap gap-2">
            {(Object.keys(authorSorts) as AuthorSort[]).map((sortKey) => (
              <Link
                key={sortKey}
                href={authorSortPath(detail.name, sortKey)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  sortKey === sort
                    ? "border-brand/40 bg-brand/10 text-foreground"
                    : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {authorSorts[sortKey].label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-5">
          <PluginListTable plugins={plugins.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={authorSortPath(detail.name, sort)}
          page={plugins.page}
          perPage={plugins.perPage}
          total={plugins.total}
          totalPages={plugins.totalPages}
          hrefForPage={(targetPage) => authorSortPath(detail.name, sort, targetPage)}
        />
      </section>
    </AppShell>
  );
}

function AuthorStat({
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

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}
