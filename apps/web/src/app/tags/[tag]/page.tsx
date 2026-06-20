import type { Metadata } from "next";
import {
  generateTagMetadata,
  generateTagStaticParams,
  TagPageView,
} from "./tag-page-view";

export const revalidate = 1_800;

type TagPageProps = {
  params: Promise<{ tag: string }>;
};

export const generateStaticParams = generateTagStaticParams;

export async function generateMetadata({
  params,
}: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  return generateTagMetadata({ tag });
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  return <TagPageView tag={tag} />;
}
