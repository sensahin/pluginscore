import { AppShell } from "@/components/app-shell";
import { getAuthors } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import { AuthorIndexView } from "./author-index-view";

export const metadata = seoMetadata({
  title: "WordPress Plugin Authors",
  description:
    "Browse WordPress plugin authors by indexed plugins, audited plugins, active installs, downloads, findings, and average PluginScore results.",
  path: "/authors",
});

export const revalidate = 1_800;

const AUTHOR_INDEX_LIMIT = 150;

export default async function AuthorsPage() {
  const authors = await getAuthors(AUTHOR_INDEX_LIMIT, "installs_desc");

  return (
    <AppShell>
      <AuthorIndexView initialAuthors={authors} limit={AUTHOR_INDEX_LIMIT} />
    </AppShell>
  );
}
