import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getPluginsPage } from "@/lib/api";
import {
  canonicalPath,
  normalizePageParam,
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { seoMetadata } from "@/lib/seo";

const rankingKinds = {
  best: {
    title: "Top Scores",
    seoTitle: "Best Scored WordPress Plugins",
    description: "Highest current WordPress plugin scores in the PluginScore audit index.",
    sort: "score_desc",
    audited: true,
  },
  worst: {
    title: "Needs Review",
    seoTitle: "WordPress Plugins That Need Review",
    description: "WordPress plugins with the lowest current PluginScore audit scores and the most visible review risk.",
    sort: "score_asc",
    audited: true,
  },
  "most-installed": {
    title: "Most Installed Plugins",
    seoTitle: "Most Installed WordPress Plugins",
    description: "Popular WordPress plugins ranked by active install count with PluginScore audit context.",
    sort: "installs_desc",
    audited: false,
  },
  "most-downloaded": {
    title: "Most Downloaded Plugins",
    seoTitle: "Most Downloaded WordPress Plugins",
    description: "Popular WordPress plugins ranked by WordPress.org download count with PluginScore audit context.",
    sort: "downloads_desc",
    audited: false,
  },
  "most-issues": {
    title: "Most Issues",
    seoTitle: "WordPress Plugins With the Most Issues",
    description: "Audited WordPress plugins ranked by current Plugin Check finding count.",
    sort: "issues_desc",
    audited: true,
  },
  "most-improved": {
    title: "Most Improved Plugins",
    seoTitle: "Most Improved WordPress Plugins",
    description: "WordPress plugins with the largest positive PluginScore movement between audit snapshots.",
    sort: "delta_desc",
    audited: true,
  },
  "recently-updated": {
    title: "Recently Scanned",
    seoTitle: "Recently Scanned WordPress Plugins",
    description: "WordPress plugins ordered by latest completed PluginScore audit and Plugin Check scan date.",
    sort: "scanned_desc",
    audited: true,
  },
} as const;

type RankingKind = keyof typeof rankingKinds;

type RankingPageProps = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ page?: string }>;
};

export function generateStaticParams() {
  return Object.keys(rankingKinds).map((kind) => ({ kind }));
}

export async function generateMetadata({
  params,
  searchParams,
}: RankingPageProps): Promise<Metadata> {
  const { kind } = await params;
  const page = normalizePageParam((await searchParams).page);
  const ranking = rankingKinds[kind as RankingKind];

  if (!ranking) {
    return {};
  }

  return seoMetadata({
    title: titleWithPage(ranking.seoTitle, page),
    description: ranking.description,
    path: canonicalPath(`/rankings/${encodeURIComponent(kind)}`, page),
  });
}

export default async function RankingKindPage({ params, searchParams }: RankingPageProps) {
  const { kind } = await params;
  const page = normalizePageParam((await searchParams).page);
  const ranking = rankingKinds[kind as RankingKind];

  if (!ranking) {
    notFound();
  }

  const plugins = await getPluginsPage({
    page,
    perPage: PLUGIN_DIRECTORY_PER_PAGE,
    sort: ranking.sort,
    audited: ranking.audited,
  });
  const rankOffset = (plugins.page - 1) * plugins.perPage;

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            {ranking.title}
          </h1>
        </div>
        <div className="p-5">
          <PluginListTable plugins={plugins.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={`/rankings/${encodeURIComponent(kind)}`}
          page={plugins.page}
          perPage={plugins.perPage}
          total={plugins.total}
          totalPages={plugins.totalPages}
        />
      </section>
    </AppShell>
  );
}
