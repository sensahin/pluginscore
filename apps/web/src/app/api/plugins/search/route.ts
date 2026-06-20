import { NextResponse } from "next/server";
import { getPluginsPage } from "@/lib/api";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "Vercel-CDN-Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 20)
    : 8;

  if (!query) {
    return NextResponse.json({ items: [] }, { headers: cacheHeaders });
  }

  const result = await getPluginsPage({
    page: 1,
    perPage: limit,
    sort: "relevance_desc",
    query,
  });

  return NextResponse.json(
    {
      items: result.items,
      total: result.total,
    },
    { headers: cacheHeaders },
  );
}
