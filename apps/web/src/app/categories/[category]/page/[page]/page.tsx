import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  categoryPagePath,
  CategoryPageView,
  generateCategoryMetadata,
} from "../../category-page-view";

export const revalidate = 1_800;
export const dynamic = "force-static";

type CategoryPaginatedPageProps = {
  params: Promise<{ category: string; page: string }>;
};

export async function generateMetadata({
  params,
}: CategoryPaginatedPageProps): Promise<Metadata> {
  const { category, page: pageParam } = await params;
  const page = pageFromSegment(pageParam) ?? 1;
  return generateCategoryMetadata({ category, page });
}

export default async function CategoryPaginatedPage({
  params,
}: CategoryPaginatedPageProps) {
  const { category, page: pageParam } = await params;
  const page = pageFromSegment(pageParam);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect(categoryPagePath(category));
  }

  return <CategoryPageView category={category} page={page} />;
}
