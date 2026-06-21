import { NextResponse } from "next/server";
import {
  fetchPluginBySlug,
  normalizeWordPressPluginSlug,
} from "@pluginscore/wporg";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "Vercel-CDN-Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = url.searchParams.get("input") ?? url.searchParams.get("slug") ?? "";
  const slug = normalizeWordPressPluginSlug(input);

  if (!slug) {
    return NextResponse.json(
      { error: "invalid_plugin_slug" },
      { status: 400, headers: cacheHeaders },
    );
  }

  let plugin;
  try {
    plugin = await fetchPluginBySlug(slug);
  } catch {
    return NextResponse.json(
      { error: "wordpress_org_unavailable", slug },
      { status: 502 },
    );
  }

  if (!plugin) {
    return NextResponse.json(
      { error: "wordpress_plugin_not_found", slug },
      { status: 404, headers: cacheHeaders },
    );
  }

  return NextResponse.json(
    {
      slug: plugin.slug,
      name: plugin.name,
      version: plugin.version,
      activeInstalls: plugin.activeInstalls,
      rating: plugin.rating,
      ratingCount: plugin.ratingCount,
    },
    { headers: cacheHeaders },
  );
}
