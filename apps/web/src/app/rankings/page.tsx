import { generateRankingMetadata, RankingPageView } from "./ranking-page-view";

export const revalidate = 1_800;

export const metadata = generateRankingMetadata({});

export default async function RankingsPage() {
  return <RankingPageView />;
}
