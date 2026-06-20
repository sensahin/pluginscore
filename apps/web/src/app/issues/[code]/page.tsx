import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { PluginListTable } from "@/components/plugin-list-table";
import { getIssue, getPluginsPage } from "@/lib/api";
import {
  canonicalPath,
  normalizePageParam,
  PLUGIN_DIRECTORY_PER_PAGE,
  titleWithPage,
} from "@/lib/pagination";
import { issues } from "@/lib/plugin-score-data";
import { seoDisplayName, seoMetadata } from "@/lib/seo";

export const revalidate = 1_800;

type IssuePageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ page?: string }>;
};

export function generateStaticParams() {
  return issues.map((issue) => ({ code: encodeURIComponent(issue.code) }));
}

export async function generateMetadata({
  params,
  searchParams,
}: IssuePageProps): Promise<Metadata> {
  const { code } = await params;
  const page = normalizePageParam((await searchParams).page);
  const issue = await getIssue(code);

  if (!issue) {
    return {};
  }

  const issueTitle = seoDisplayName(issue.title);

  return seoMetadata({
    title: titleWithPage(`${issueTitle} in WordPress Plugins`, page),
    description: `Learn what ${issueTitle} means in WordPress plugins, why Plugin Check reports it, why it matters, and how to fix the finding.`,
    path: canonicalPath(`/issues/${encodeURIComponent(issue.code)}`, page),
  });
}

export default async function IssuePage({ params, searchParams }: IssuePageProps) {
  const { code } = await params;
  const page = normalizePageParam((await searchParams).page);
  const issue = await getIssue(code);

  if (!issue) {
    notFound();
  }

  const affected = await getPluginsPage({
    page,
    perPage: PLUGIN_DIRECTORY_PER_PAGE,
    sort: "score_asc",
    audited: true,
    issueCode: issue.code,
  });
  const rankOffset = (affected.page - 1) * affected.perPage;

  return (
    <AppShell>
      <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="break-all font-mono text-sm leading-6 text-muted">{issue.code}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              {issue.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              {issue.explanation}
            </p>
          </div>
          <span className="rounded-md bg-surface-subtle px-3 py-2 text-sm font-semibold">
            {issue.weight} weight
          </span>
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <IssueExplainerCard
          title="Why It Shows Up"
          body={issue.whyItShowsUp ?? issue.explanation}
        />
        <IssueExplainerCard
          title="Why It Matters"
          body={issue.whyItMatters ?? issue.explanation}
        />
        <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">How to Fix</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-muted">
            {(issue.howToFix?.length ? issue.howToFix : [issue.fix]).map(
              (step) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  <span>{step}</span>
                </li>
              ),
            )}
          </ul>
        </div>

        {issue.notes?.length ? (
          <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Notes</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-muted">
              {issue.notes.map((note) => (
                <li key={note} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-surface-subtle" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {issue.references?.length ? (
          <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">References</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {issue.references.map((reference) => (
                <a
                  key={reference.href}
                  href={reference.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md border border-line px-3 py-2 text-sm font-medium text-info transition hover:bg-surface-subtle"
                >
                  {reference.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="min-w-0 rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="text-base font-semibold">Affected Plugins</h2>
        </div>
        <div className="p-5">
          <PluginListTable plugins={affected.items} rankOffset={rankOffset} />
        </div>
        <PaginationControls
          basePath={`/issues/${encodeURIComponent(issue.code)}`}
          page={affected.page}
          perPage={affected.perPage}
          total={affected.total}
          totalPages={affected.totalPages}
        />
      </section>
    </AppShell>
  );
}

function IssueExplainerCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
