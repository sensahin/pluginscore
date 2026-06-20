import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getIssues, getPluginsPage } from "@/lib/api";
import {
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { issues as sampleIssues } from "@/lib/plugin-score-data";
import { slugifyLabel, titleFromSlug } from "@/lib/route-utils";
import { seoDisplayName, seoMetadata } from "@/lib/seo";

type CategoryPageViewProps = {
  category: string;
  page?: number;
};

export function generateCategoryStaticParams() {
  const categories = new Set(sampleIssues.map((issue) => slugifyLabel(issue.family)));
  return [...categories].map((category) => ({ category }));
}

export function categoryPagePath(category: string, page = 1) {
  const basePath = `/categories/${encodeURIComponent(category)}`;
  return page > 1 ? `${basePath}/page/${page}` : basePath;
}

export async function generateCategoryMetadata({
  category,
  page = 1,
}: CategoryPageViewProps): Promise<Metadata> {
  const categoryName = seoDisplayName(titleFromSlug(category));
  const title = `${categoryName} WordPress Plugin Scores`;

  return seoMetadata({
    title: titleWithPage(title, page),
    description: `${categoryName} WordPress plugin scores and Plugin Check issue codes, including affected plugins, scoring weights, explanations, and fix guidance.`,
    path: categoryPagePath(category, page),
  });
}

export async function CategoryPageView({
  category,
  page = 1,
}: CategoryPageViewProps) {
  const [allIssues, affectedPlugins] = await Promise.all([
    getIssues(),
    getPluginsPage({
      page,
      perPage: PLUGIN_DIRECTORY_PER_PAGE,
      sort: "score_asc",
      audited: true,
      issueFamily: category,
    }),
  ]);
  const categoryIssues = allIssues.filter(
    (issue) => slugifyLabel(issue.family) === category,
  );

  if (categoryIssues.length === 0) {
    notFound();
  }

  const title = titleFromSlug(category);
  const rankOffset = (affectedPlugins.page - 1) * affectedPlugins.perPage;

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">
          {title} Issues
        </h1>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="text-base font-semibold">Issue Codes</h2>
          <p className="mt-1 text-sm text-muted">
            {categoryIssues.length} normalized finding codes in this category.
          </p>
        </div>
        <div className="divide-y divide-line">
          {categoryIssues.map((issue) => (
            <Link
              key={issue.code}
              href={`/issues/${encodeURIComponent(issue.code)}`}
              className="block p-5 transition hover:bg-surface-subtle"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{issue.title}</h3>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {issue.code}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    {issue.explanation}
                  </p>
                </div>
                <span className="w-fit rounded-md bg-surface-subtle px-2 py-1 text-xs font-semibold">
                  {issue.weight}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="text-base font-semibold">Affected Plugins</h2>
        </div>
        <div className="p-5">
          <PluginListTable plugins={affectedPlugins.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={categoryPagePath(category)}
          page={affectedPlugins.page}
          perPage={affectedPlugins.perPage}
          total={affectedPlugins.total}
          totalPages={affectedPlugins.totalPages}
          hrefForPage={(targetPage) => categoryPagePath(category, targetPage)}
        />
      </section>
    </AppShell>
  );
}
