import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { PluginRelationshipMap } from "@/components/plugin-relationship-map";
import { getPluginsPage } from "@/lib/api";
import {
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { buildRankingRelationshipMap } from "@/lib/plugin-relationship-map";
import { seoMetadata } from "@/lib/seo";

export const rankingKinds = {
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
    description:
      "WordPress plugins with the lowest current PluginScore audit scores and the most visible review risk.",
    sort: "score_asc",
    audited: true,
  },
  "most-installed": {
    title: "Most Installed Plugins",
    seoTitle: "Most Installed WordPress Plugins",
    description:
      "Popular WordPress plugins ranked by active install count with PluginScore audit context.",
    sort: "installs_desc",
    audited: false,
  },
  "most-downloaded": {
    title: "Most Downloaded Plugins",
    seoTitle: "Most Downloaded WordPress Plugins",
    description:
      "Popular WordPress plugins ranked by WordPress.org download count with PluginScore audit context.",
    sort: "downloads_desc",
    audited: false,
  },
  "new-popular": {
    title: "New & Popular Plugins",
    seoTitle: "New & Popular WordPress Plugins",
    description:
      "WordPress plugins added in the last 24 months that already have meaningful active installs.",
    sort: "new_popular_desc",
    audited: false,
  },
  "most-issues": {
    title: "Most Issues",
    seoTitle: "WordPress Plugins With the Most Issues",
    description:
      "Audited WordPress plugins ranked by current Plugin Check finding count.",
    sort: "issues_desc",
    audited: true,
  },
  "most-improved": {
    title: "Most Improved Plugins",
    seoTitle: "Most Improved WordPress Plugins",
    description:
      "WordPress plugins with the largest positive PluginScore movement between audit snapshots.",
    sort: "delta_desc",
    audited: true,
  },
  "recently-updated": {
    title: "Recently Scanned",
    seoTitle: "Recently Scanned WordPress Plugins",
    description:
      "WordPress plugins ordered by latest completed PluginScore audit and Plugin Check scan date.",
    sort: "scanned_desc",
    audited: true,
  },
} as const;

export type RankingKind = keyof typeof rankingKinds;
const defaultRankingKind: RankingKind = "most-installed";

type RankingPageViewProps = {
  kind?: RankingKind;
  page?: number;
};

const rankingLinks = [
  { href: "/rankings/best", label: "Top Scores", kind: "best" },
  { href: "/rankings/worst", label: "Needs Review", kind: "worst" },
  { href: "/rankings/most-installed", label: "Most Installed", kind: "most-installed" },
  { href: "/rankings/most-downloaded", label: "Most Downloaded", kind: "most-downloaded" },
  { href: "/rankings/new-popular", label: "New & Popular", kind: "new-popular" },
  { href: "/rankings/most-issues", label: "Most Issues", kind: "most-issues" },
  { href: "/rankings/most-improved", label: "Most Improved", kind: "most-improved" },
  { href: "/rankings/recently-updated", label: "Recently Scanned", kind: "recently-updated" },
] as const;

export function generateRankingKindStaticParams() {
  return Object.keys(rankingKinds).map((kind) => ({ kind }));
}

export function rankingPagePath(kind: RankingKind | undefined, page = 1) {
  const basePath = kind ? `/rankings/${encodeURIComponent(kind)}` : "/rankings";
  return page > 1 ? `${basePath}/page/${page}` : basePath;
}

export function rankingKindFromParam(kind: string) {
  return kind in rankingKinds ? (kind as RankingKind) : null;
}

export function generateRankingMetadata({
  kind,
  page = 1,
}: RankingPageViewProps): Metadata {
  const ranking = rankingKinds[kind ?? defaultRankingKind];

  return seoMetadata({
    title: titleWithPage(ranking.seoTitle, page),
    description: ranking.description,
    path: rankingPagePath(kind, page),
  });
}

export async function RankingPageView({ kind, page = 1 }: RankingPageViewProps) {
  const activeKind = kind ?? defaultRankingKind;
  const ranking = rankingKinds[activeKind];

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
  const relationshipMap = activeKind === "most-installed" && plugins.page === 1
    ? buildRankingRelationshipMap({
        title: "Most Installed Map",
        href: "/rankings/most-installed",
        plugins: plugins.items,
        limit: 25,
      })
    : null;

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            {ranking.title}
          </h1>
          <nav className="mt-4 flex flex-wrap gap-2">
            {rankingLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  link.kind === activeKind
                    ? "border-brand/40 bg-brand/10 text-foreground"
                    : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-5">
          <PluginListTable plugins={plugins.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={rankingPagePath(kind)}
          page={plugins.page}
          perPage={plugins.perPage}
          total={plugins.total}
          totalPages={plugins.totalPages}
          hrefForPage={(targetPage) => rankingPagePath(kind, targetPage)}
        />
      </section>
      {relationshipMap ? (
        <div className="mt-6">
          <PluginRelationshipMap
            data={relationshipMap}
            title="Most Installed Map"
            description="Top 25 plugins by active installs, connected by authors and categories."
            linksLabel="Map links"
            sectionId="most-installed-map"
          />
        </div>
      ) : null}
    </AppShell>
  );
}
