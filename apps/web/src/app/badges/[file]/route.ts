import { getPlugin } from "@/lib/api";
import type { PluginBadgeTone } from "@/lib/plugin-badge";
import {
  pluginBadgeTone,
  pluginBadgeValue,
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
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  const slug = normalizeBadgeSlug(file);

  if (!slug) {
    return badgeResponse(
      "not found",
      "missing",
      "PluginScore badge not found",
      200,
      missingCacheHeaders,
    );
  }

  const plugin = await getPlugin(slug);

  if (!plugin) {
    return badgeResponse(
      "not found",
      "missing",
      `${slug} PluginScore not found`,
      200,
      missingCacheHeaders,
    );
  }

  const value = pluginBadgeValue(plugin);
  const tone = pluginBadgeTone(plugin);
  const title =
    plugin.audited === false
      ? `${plugin.name} PluginScore pending`
      : `${plugin.name} PluginScore ${value}`;

  return badgeResponse(value, tone, title, 200, badgeCacheHeaders);
}

function badgeResponse(
  value: string,
  tone: PluginBadgeTone,
  title: string,
  status: number,
  headers: HeadersInit,
) {
  return new Response(renderPluginScoreBadge({ value, tone, title }), {
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
