import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  generateTagMetadata,
  tagSortFromSegment,
  tagSortPath,
  TagPageView,
} from "../../../tag-page-view";

export const revalidate = 1_800;
export const dynamic = "force-static";

type TagSortPaginatedPageProps = {
  params: Promise<{ tag: string; sort: string; page: string }>;
};

export async function generateMetadata({
  params,
}: TagSortPaginatedPageProps): Promise<Metadata> {
  const { tag, sort: sortParam, page: pageParam } = await params;
  const sort = tagSortFromSegment(sortParam);
  const page = pageFromSegment(pageParam) ?? 1;

  if (!sort) {
    return {};
  }

  return generateTagMetadata({ tag, sort, page });
}

export default async function TagSortPaginatedPage({
  params,
}: TagSortPaginatedPageProps) {
  const { tag, sort: sortParam, page: pageParam } = await params;
  const sort = tagSortFromSegment(sortParam);
  const page = pageFromSegment(pageParam);

  if (!sort || !page) {
    notFound();
  }

  if (page === 1) {
    redirect(tagSortPath(tag, sort));
  }

  return <TagPageView tag={tag} sort={sort} page={page} />;
}
