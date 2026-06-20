import type { Metadata } from "next";
import Link from "next/link";
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

const rankingLinks = [
  { href: "/rankings/best", label: "Top Scores" },
  { href: "/rankings/worst", label: "Needs Review" },
  { href: "/rankings/most-installed", label: "Most Installed" },
  { href: "/rankings/most-downloaded", label: "Most Downloaded" },
  { href: "/rankings/most-issues", label: "Most Issues" },
  { href: "/rankings/most-improved", label: "Most Improved" },
  { href: "/rankings/recently-updated", label: "Recently Scanned" },
];

export const revalidate = 1_800;

type RankingsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: RankingsPageProps): Promise<Metadata> {
  const page = normalizePageParam((await searchParams).page);

  return seoMetadata({
    title: titleWithPage("WordPress Plugin Rankings", page),
    description:
      "Browse WordPress plugin rankings by score, downloads, recent scans, score movement, and plugins that need review.",
    path: canonicalPath("/rankings", page),
  });
}

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const page = normalizePageParam((await searchParams).page);
  const ranked = await getPluginsPage({
    page,
    perPage: PLUGIN_DIRECTORY_PER_PAGE,
    sort: "score_desc",
    audited: true,
  });
  const rankOffset = (ranked.page - 1) * ranked.perPage;

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            Plugin Rankings
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {rankingLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-line px-3 py-2 text-sm font-medium transition hover:bg-surface-subtle"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="p-5">
          <PluginListTable plugins={ranked.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath="/rankings"
          page={ranked.page}
          perPage={ranked.perPage}
          total={ranked.total}
          totalPages={ranked.totalPages}
        />
      </section>
    </AppShell>
  );
}
