import { AppShell } from "@/components/app-shell";
import { IssueTaxonomyTable } from "@/components/issue-taxonomy-table";
import { getIssues } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "WordPress Plugin Issues",
  description:
    "Browse WordPress Plugin Check issue codes, affected plugins, scoring weights, explanations, and fix guidance in PluginScore.",
  path: "/issues",
});

export const revalidate = 1_800;

export default async function IssuesPage() {
  const issues = await getIssues();

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">
          Issue Taxonomy
        </h1>
      </section>

      <IssueTaxonomyTable issues={issues} title="All Issues" />
    </AppShell>
  );
}
