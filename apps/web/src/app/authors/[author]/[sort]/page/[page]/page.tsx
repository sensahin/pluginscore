import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  authorSortFromSegment,
  authorSortPath,
  AuthorPageView,
  generateAuthorMetadata,
} from "../../../author-page-view";

export const revalidate = 1_800;

type AuthorSortPaginatedPageProps = {
  params: Promise<{ author: string; sort: string; page: string }>;
};

export async function generateMetadata({
  params,
}: AuthorSortPaginatedPageProps): Promise<Metadata> {
  const { author, sort: sortParam, page: pageParam } = await params;
  const sort = authorSortFromSegment(sortParam);
  const page = pageFromSegment(pageParam) ?? 1;

  if (!sort) {
    return {};
  }

  return generateAuthorMetadata({ author, sort, page });
}

export default async function AuthorSortPaginatedPage({
  params,
}: AuthorSortPaginatedPageProps) {
  const { author, sort: sortParam, page: pageParam } = await params;
  const sort = authorSortFromSegment(sortParam);
  const page = pageFromSegment(pageParam);

  if (!sort || !page) {
    notFound();
  }

  if (page === 1) {
    redirect(authorSortPath(author, sort));
  }

  return <AuthorPageView author={author} sort={sort} page={page} />;
}
