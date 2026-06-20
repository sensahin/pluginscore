import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  generateRankingKindStaticParams,
  generateRankingMetadata,
  rankingKindFromParam,
  RankingPageView,
} from "../ranking-page-view";

export const revalidate = 1_800;

type RankingKindPageProps = {
  params: Promise<{ kind: string }>;
};

export const generateStaticParams = generateRankingKindStaticParams;

export async function generateMetadata({
  params,
}: RankingKindPageProps): Promise<Metadata> {
  const { kind: kindParam } = await params;
  const kind = rankingKindFromParam(kindParam);

  if (!kind) {
    return {};
  }

  return generateRankingMetadata({ kind });
}

export default async function RankingKindPage({
  params,
}: RankingKindPageProps) {
  const { kind: kindParam } = await params;
  const kind = rankingKindFromParam(kindParam);

  if (!kind) {
    notFound();
  }

  return <RankingPageView kind={kind} />;
}
