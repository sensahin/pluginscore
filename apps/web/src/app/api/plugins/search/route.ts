import { NextResponse } from "next/server";
import { getPluginsPage } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 20)
    : 8;

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const result = await getPluginsPage({
    page: 1,
    perPage: limit,
    sort: "relevance_desc",
    query,
  });

  return NextResponse.json({
    items: result.items,
    total: result.total,
  });
}
