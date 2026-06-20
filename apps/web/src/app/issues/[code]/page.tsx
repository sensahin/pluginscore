import type { Metadata } from "next";
import {
  generateIssueMetadata,
  generateIssueStaticParams,
  IssuePageView,
} from "./issue-page-view";

export const revalidate = 1_800;

type IssuePageProps = {
  params: Promise<{ code: string }>;
};

export const generateStaticParams = generateIssueStaticParams;

export async function generateMetadata({
  params,
}: IssuePageProps): Promise<Metadata> {
  const { code } = await params;
  return generateIssueMetadata({ code });
}

export default async function IssuePage({ params }: IssuePageProps) {
  const { code } = await params;
  return <IssuePageView code={code} />;
}
