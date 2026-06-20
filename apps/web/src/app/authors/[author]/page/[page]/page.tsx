import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  authorSortPath,
  AuthorPageView,
  generateAuthorMetadata,
} from "../../author-page-view";
import { pageFromSegment } from "@/lib/pagination";

export const revalidate = 1_800;
export const dynamic = "force-static";

type AuthorPaginatedPageProps = {
  params: Promise<{ author: string; page: string }>;
};

export async function generateMetadata({
  params,
}: AuthorPaginatedPageProps): Promise<Metadata> {
  const { author, page: pageParam } = await params;
  const page = pageFromSegment(pageParam) ?? 1;
  return generateAuthorMetadata({ author, page });
}

export default async function AuthorPaginatedPage({
  params,
}: AuthorPaginatedPageProps) {
  const { author, page: pageParam } = await params;
  const page = pageFromSegment(pageParam);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect(authorSortPath(author));
  }

  return <AuthorPageView author={author} page={page} />;
}
