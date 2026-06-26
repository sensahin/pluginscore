import { getPlugin } from "@/lib/api";
import {
  buildPluginBadgeContent,
  parsePluginBadgeOptions,
  renderPluginScoreBadge,
} from "@/lib/plugin-badge";

export const revalidate = 1_800;

const badgeCacheHeaders = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
};

const missingCacheHeaders = {
  ...badgeCacheHeaders,
  "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  "Vercel-CDN-Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  const url = new URL(request.url);
  const options = parsePluginBadgeOptions(url.searchParams);
  const slug = normalizeBadgeSlug(file);

  if (!slug) {
    return badgeResponse(
      {
        label: "PluginScore",
        value: "not found",
        title: "PluginScore badge not found",
        tone: "missing",
      },
      options,
      200,
      missingCacheHeaders,
    );
  }

  const plugin = await getPlugin(slug);

  if (!plugin) {
    return badgeResponse(
      {
        label: "PluginScore",
        value: "not found",
        title: `${slug} PluginScore not found`,
        tone: "missing",
      },
      options,
      200,
      missingCacheHeaders,
    );
  }

  return badgeResponse(
    buildPluginBadgeContent(plugin, options),
    options,
    200,
    badgeCacheHeaders,
  );
}

function badgeResponse(
  content: Parameters<typeof renderPluginScoreBadge>[0]["content"],
  options: Parameters<typeof renderPluginScoreBadge>[0]["options"],
  status: number,
  headers: HeadersInit,
) {
  return new Response(renderPluginScoreBadge({ content, options }), {
    status,
    headers,
  });
}

function normalizeBadgeSlug(file: string) {
  const rawSlug = file.toLowerCase().endsWith(".svg")
    ? file.slice(0, -4)
    : file;

  return rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}
