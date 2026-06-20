import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  authorSortFromSegment,
  AuthorPageView,
  generateAuthorMetadata,
  generateAuthorSortStaticParams,
} from "../author-page-view";

export const revalidate = 1_800;

type AuthorSortPageProps = {
  params: Promise<{ author: string; sort: string }>;
};

export const generateStaticParams = generateAuthorSortStaticParams;

export async function generateMetadata({
  params,
}: AuthorSortPageProps): Promise<Metadata> {
  const { author, sort: sortParam } = await params;
  const sort = authorSortFromSegment(sortParam);

  if (!sort) {
    return {};
  }

  return generateAuthorMetadata({ author, sort });
}

export default async function AuthorSortPage({ params }: AuthorSortPageProps) {
  const { author, sort: sortParam } = await params;
  const sort = authorSortFromSegment(sortParam);

  if (!sort) {
    notFound();
  }

  return <AuthorPageView author={author} sort={sort} />;
}
