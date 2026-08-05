import { generateRankingMetadata, RankingPageView } from "./ranking-page-view";

export const revalidate = 21_600;

export const metadata = generateRankingMetadata({});

export default async function RankingsPage() {
  return <RankingPageView />;
}
