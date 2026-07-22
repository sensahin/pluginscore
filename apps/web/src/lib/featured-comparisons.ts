import type { ComparisonPluginSummary, PluginSummary } from "@pluginscore/core";

export const FEATURED_COMPARISON_SLUGS = [
  ["wordpress-seo", "seo-by-rank-math", "all-in-one-seo-pack"],
  [
    "wordfence",
    "all-in-one-wp-security-and-firewall",
    "limit-login-attempts-reloaded",
  ],
  ["classic-editor", "tinymce-advanced"],
  [
    "essential-addons-for-elementor-lite",
    "elementskit-lite",
    "header-footer-elementor",
  ],
  ["contact-form-7", "wpforms-lite"],
  ["litespeed-cache", "wp-super-cache", "wp-fastest-cache"],
  ["all-in-one-wp-migration", "updraftplus", "duplicator"],
  ["google-site-kit", "google-analytics-for-wordpress"],
] as const;

export function buildFeaturedComparisons(plugins: PluginSummary[]) {
  const pluginsBySlug = new Map(plugins.map((plugin) => [plugin.slug, plugin]));

  return FEATURED_COMPARISON_SLUGS.flatMap(
    (slugs): ComparisonPluginSummary[][] => {
      const comparison = slugs
        .map((slug) => pluginsBySlug.get(slug))
        .filter((plugin): plugin is PluginSummary => Boolean(plugin))
        .map((plugin) => ({
          slug: plugin.slug,
          name: plugin.name,
          ...(plugin.iconUrl ? { iconUrl: plugin.iconUrl } : {}),
          score: plugin.score,
          activeInstalls: plugin.activeInstalls,
          audited: plugin.audited,
        }));

      return comparison.length === slugs.length ? [comparison] : [];
    },
  );
}
