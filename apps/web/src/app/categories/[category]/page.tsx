import type { Metadata } from "next";
import {
  CategoryPageView,
  generateCategoryMetadata,
  generateCategoryStaticParams,
} from "./category-page-view";

export const revalidate = 1_800;

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export const generateStaticParams = generateCategoryStaticParams;

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  return generateCategoryMetadata({ category });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  return <CategoryPageView category={category} />;
}
