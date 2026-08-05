import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  generateIssueMetadata,
  issuePagePath,
  IssuePageView,
} from "../../issue-page-view";

export const revalidate = 86_400;
export const dynamic = "force-static";

type IssuePaginatedPageProps = {
  params: Promise<{ code: string; page: string }>;
};

export async function generateMetadata({
  params,
}: IssuePaginatedPageProps): Promise<Metadata> {
  const { code, page: pageParam } = await params;
  const page = pageFromSegment(pageParam) ?? 1;
  return generateIssueMetadata({ code, page });
}

export default async function IssuePaginatedPage({
  params,
}: IssuePaginatedPageProps) {
  const { code, page: pageParam } = await params;
  const page = pageFromSegment(pageParam);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect(issuePagePath(code));
  }

  return <IssuePageView code={code} page={page} />;
}
