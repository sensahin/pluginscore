import type { WordPressPluginMetadata } from "@pluginscore/core";

type WordPressApiPlugin = {
  slug: string;
  name: string;
  version: string;
  author?: string;
  author_profile?: string;
  homepage?: string;
  short_description?: string;
  icons?: Record<string, string>;
  banners?: Record<string, string>;
  requires?: unknown;
  tested?: unknown;
  requires_php?: unknown;
  rating?: number;
  num_ratings?: number;
  support_threads?: number;
  support_threads_resolved?: number;
  active_installs?: number;
  downloaded?: number;
  last_updated?: string;
  download_link?: unknown;
  tags?: Record<string, string>;
  error?: string;
};

type WordPressApiResponse = {
  plugins?: WordPressApiPlugin[];
};

export async function fetchPopularPlugins(limit: number) {
  const plugins: WordPressPluginMetadata[] = [];
  let page = 1;

  while (plugins.length < limit) {
    const perPage = Math.min(100, limit - plugins.length);
    const url = buildPopularPluginsUrl(page, perPage);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`WordPress.org API failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as WordPressApiResponse;
    const batch = data.plugins ?? [];

    if (batch.length === 0) {
      break;
    }

    for (const plugin of batch) {
      const metadata = pluginToMetadata(plugin);
      if (metadata) {
        plugins.push(metadata);
      }
    }

    page += 1;
  }

  return plugins.slice(0, limit);
}

export async function fetchPluginBySlug(input: string) {
  const slug = normalizeWordPressPluginSlug(input);
  if (!slug) {
    return null;
  }

  const response = await fetch(buildPluginInformationUrl(slug));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`WordPress.org API failed: ${response.status} ${await response.text()}`);
  }

  const plugin = (await response.json()) as WordPressApiPlugin;
  if (plugin.error) {
    return null;
  }

  return pluginToMetadata(plugin);
}

export function normalizeWordPressPluginSlug(value: string) {
  const trimmed = value.trim().toLowerCase();
  let slug = trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname === "wordpress.org" && url.pathname.startsWith("/plugins/")) {
      slug = url.pathname.replace(/^\/plugins\//, "").split("/")[0] ?? "";
    }
  } catch {
    slug = trimmed
      .replace(/^https?:\/\/wordpress\.org\/plugins\//, "")
      .replace(/^wordpress\.org\/plugins\//, "");
  }

  return slug
    .replace(/\/$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPopularPluginsUrl(page: number, perPage: number) {
  const params = new URLSearchParams();
  params.set("action", "query_plugins");
  params.set("request[browse]", "popular");
  params.set("request[page]", String(page));
  params.set("request[per_page]", String(perPage));
  addPluginFields(params);

  return `https://api.wordpress.org/plugins/info/1.2/?${params}`;
}

function buildPluginInformationUrl(slug: string) {
  const params = new URLSearchParams();
  params.set("action", "plugin_information");
  params.set("request[slug]", slug);
  addPluginFields(params);

  return `https://api.wordpress.org/plugins/info/1.2/?${params}`;
}

function addPluginFields(params: URLSearchParams) {
  params.set("request[fields][description]", "0");
  params.set("request[fields][sections]", "0");
  params.set("request[fields][short_description]", "1");
  params.set("request[fields][downloaded]", "1");
  params.set("request[fields][downloadlink]", "1");
  params.set("request[fields][last_updated]", "1");
  params.set("request[fields][active_installs]", "1");
  params.set("request[fields][icons]", "1");
  params.set("request[fields][banners]", "1");
  params.set("request[fields][author]", "1");
  params.set("request[fields][author_profile]", "1");
  params.set("request[fields][homepage]", "1");
  params.set("request[fields][requires]", "1");
  params.set("request[fields][tested]", "1");
  params.set("request[fields][requires_php]", "1");
  params.set("request[fields][rating]", "1");
  params.set("request[fields][num_ratings]", "1");
  params.set("request[fields][support_threads]", "1");
  params.set("request[fields][support_threads_resolved]", "1");
  params.set("request[fields][tags]", "1");
}

function pluginToMetadata(plugin: WordPressApiPlugin): WordPressPluginMetadata | null {
  if (!plugin.slug || !plugin.version || !isHttpUrl(plugin.download_link)) {
    return null;
  }

  return {
    slug: plugin.slug,
    name: cleanText(plugin.name) ?? plugin.slug,
    shortDescription: cleanText(plugin.short_description),
    iconUrl: pickAsset(plugin.icons, ["svg", "2x", "1x", "default"]),
    bannerUrl: pickAsset(plugin.banners, ["high", "low"]),
    author: cleanText(plugin.author),
    authorUrl: isHttpUrl(plugin.author_profile) ? plugin.author_profile : undefined,
    homepageUrl: isHttpUrl(plugin.homepage) ? plugin.homepage : undefined,
    requiresWp: cleanText(plugin.requires),
    testedWp: cleanText(plugin.tested),
    requiresPhp: cleanText(plugin.requires_php),
    rating: plugin.rating,
    ratingCount: plugin.num_ratings,
    supportThreads: plugin.support_threads,
    supportThreadsResolved: plugin.support_threads_resolved,
    version: plugin.version,
    activeInstalls: plugin.active_installs,
    downloaded: plugin.downloaded,
    lastUpdated: normalizeWordPressDate(plugin.last_updated),
    downloadLink: plugin.download_link,
    tags: normalizeTags(plugin.tags),
  };
}

function pickAsset(assets: Record<string, string> | undefined, preferred: string[]) {
  if (!assets) {
    return undefined;
  }

  for (const key of preferred) {
    const value = assets[key];
    if (isHttpUrl(value)) {
      return value;
    }
  }

  return Object.values(assets).find(isHttpUrl);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function cleanText(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeTags(tags: Record<string, string> | undefined) {
  if (!tags) {
    return undefined;
  }

  const normalized = Object.entries(tags)
    .map(([slug, name]) => ({
      slug: slugifyTag(slug),
      name: cleanText(name) ?? slug,
    }))
    .filter((tag) => tag.slug && tag.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return normalized.length ? normalized : undefined;
}

function slugifyTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWordPressDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  const wordpressMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(am|pm)\s+GMT$/i,
  );

  if (wordpressMatch) {
    const [, year, month, day, hourToken, minuteToken, meridiem] = wordpressMatch;
    let hour = Number.parseInt(hourToken, 10);
    const minute = Number.parseInt(minuteToken, 10);

    if (meridiem.toLowerCase() === "pm" && hour < 12) {
      hour += 12;
    }

    if (meridiem.toLowerCase() === "am" && hour === 12) {
      hour = 0;
    }

    return new Date(
      Date.UTC(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        Number.parseInt(day, 10),
        hour,
        minute,
      ),
    ).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
