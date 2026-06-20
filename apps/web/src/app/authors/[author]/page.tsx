import type { Metadata } from "next";
import {
  AuthorPageView,
  generateAuthorMetadata,
  generateAuthorStaticParams,
} from "./author-page-view";

export const revalidate = 1_800;

type AuthorPageProps = {
  params: Promise<{ author: string }>;
};

export const generateStaticParams = generateAuthorStaticParams;

export async function generateMetadata({
  params,
}: AuthorPageProps): Promise<Metadata> {
  const { author } = await params;
  return generateAuthorMetadata({ author });
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { author } = await params;
  return <AuthorPageView author={author} />;
}
