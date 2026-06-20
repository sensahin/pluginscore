import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  generateRankingMetadata,
  rankingPagePath,
  RankingPageView,
} from "../../ranking-page-view";

export const revalidate = 1_800;

type RankingsPaginatedPageProps = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({
  params,
}: RankingsPaginatedPageProps): Promise<Metadata> {
  const { page: pageParam } = await params;
  const page = pageFromSegment(pageParam) ?? 1;
  return generateRankingMetadata({ page });
}

export default async function RankingsPaginatedPage({
  params,
}: RankingsPaginatedPageProps) {
  const { page: pageParam } = await params;
  const page = pageFromSegment(pageParam);

  if (!page) {
    notFound();
  }

  if (page === 1) {
    redirect(rankingPagePath(undefined));
  }

  return <RankingPageView page={page} />;
}
