import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageFromSegment } from "@/lib/pagination";
import {
  generateRankingMetadata,
  rankingKindFromParam,
  rankingPagePath,
  RankingPageView,
} from "../../../ranking-page-view";

export const revalidate = 1_800;
export const dynamic = "force-static";

type RankingKindPaginatedPageProps = {
  params: Promise<{ kind: string; page: string }>;
};

export async function generateMetadata({
  params,
}: RankingKindPaginatedPageProps): Promise<Metadata> {
  const { kind: kindParam, page: pageParam } = await params;
  const kind = rankingKindFromParam(kindParam);
  const page = pageFromSegment(pageParam) ?? 1;

  if (!kind) {
    return {};
  }

  return generateRankingMetadata({ kind, page });
}

export default async function RankingKindPaginatedPage({
  params,
}: RankingKindPaginatedPageProps) {
  const { kind: kindParam, page: pageParam } = await params;
  const kind = rankingKindFromParam(kindParam);
  const page = pageFromSegment(pageParam);

  if (!kind || !page) {
    notFound();
  }

  if (page === 1) {
    redirect(rankingPagePath(kind));
  }

  return <RankingPageView kind={kind} page={page} />;
}
