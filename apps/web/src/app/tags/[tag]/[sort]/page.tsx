import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  generateTagMetadata,
  tagSortFromSegment,
  TagPageView,
} from "../tag-page-view";

export const revalidate = 86_400;
export const dynamic = "force-static";

type TagSortPageProps = {
  params: Promise<{ tag: string; sort: string }>;
};

export async function generateMetadata({
  params,
}: TagSortPageProps): Promise<Metadata> {
  const { tag, sort: sortParam } = await params;
  const sort = tagSortFromSegment(sortParam);

  if (!sort) {
    return {};
  }

  return generateTagMetadata({ tag, sort });
}

export default async function TagSortPage({ params }: TagSortPageProps) {
  const { tag, sort: sortParam } = await params;
  const sort = tagSortFromSegment(sortParam);

  if (!sort) {
    notFound();
  }

  return <TagPageView tag={tag} sort={sort} />;
}
