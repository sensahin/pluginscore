import { AppShell } from "@/components/app-shell";
import { getAuthors, type AuthorIndexSort } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import { AuthorIndexView } from "./author-index-view";
import { authorIndexSortKeys } from "./author-index-sorts";

export const metadata = seoMetadata({
  title: "WordPress Plugin Authors",
  description:
    "Browse WordPress plugin authors by indexed plugins, audited plugins, active installs, downloads, findings, and average PluginScore results.",
  path: "/authors",
});

export const revalidate = 1_800;

const AUTHOR_INDEX_LIMIT = 150;

export default async function AuthorsPage() {
  const entries = await Promise.all(
    authorIndexSortKeys.map(async (sort) => [
      sort,
      await getAuthors(AUTHOR_INDEX_LIMIT, sort),
    ] as const),
  );
  const authorLists = Object.fromEntries(entries) as Record<
    AuthorIndexSort,
    Awaited<ReturnType<typeof getAuthors>>
  >;

  return (
    <AppShell>
      <AuthorIndexView authorLists={authorLists} />
    </AppShell>
  );
}
