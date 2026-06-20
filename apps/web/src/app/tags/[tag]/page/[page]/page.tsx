import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  generateTagMetadata,
  tagSortPath,
  TagPageView,
} from "../../tag-page-view";
import { pageFromSegment } from "@/lib/pagination";

export const revalidate = 1_800;
export const dynamic = "force-static";

type TagPaginatedPageProps = {
  params: Promise<{ tag: string; page: string }>;
};

export async function generateMetadata({
  params,
}: TagPaginatedPageProps): Promise<Metadata> {
  const { tag, page: pageParam } = await params;
  const page = pageFromSegment(pageParam) ?? 1;
  return generateTagMetadata({ tag, page });
}

export default async function TagPaginatedPage({
  params,
}: TagPaginatedPageProps) {
  const { tag, page: pageParam } = await params;
  const page = pageFromSegment(pageParam);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect(tagSortPath(tag));
  }

  return <TagPageView tag={tag} page={page} />;
}
