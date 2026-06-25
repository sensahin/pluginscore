import { NextResponse } from "next/server";
import { getPluginIssueOccurrences } from "@/lib/api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
    code: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug, code } = await context.params;
  const url = new URL(request.url);
  const page = parseInteger(url.searchParams.get("page"), 1);
  const perPage = Math.min(parseInteger(url.searchParams.get("perPage"), 20), 100);
  const locationsOnly = url.searchParams.get("locationsOnly") === "true";

  const result = await getPluginIssueOccurrences({
    slug,
    code,
    page,
    perPage,
    locationsOnly,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function parseInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
