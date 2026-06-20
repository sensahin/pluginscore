export const MIN_COMPARE_PLUGINS = 2;
export const MAX_COMPARE_PLUGINS = 4;

export function normalizePluginSlug(value: string) {
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

export function normalizeComparisonSlugs(values: string[]) {
  const unique = new Set<string>();

  for (const value of values) {
    const slug = normalizePluginSlug(value);

    if (slug) {
      unique.add(slug);
    }
  }

  return [...unique].sort((a, b) => a.localeCompare(b)).slice(0, MAX_COMPARE_PLUGINS);
}

export function parseComparisonPath(value: string) {
  return normalizeComparisonSlugs(safeDecodeURIComponent(value).split("-vs-"));
}

export function parseComparisonQuery(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value.join(",") : value ?? "";

  return normalizeComparisonSlugs(
    rawValue
      .split(",")
      .flatMap((part) => part.split(/\s+vs\s+|-vs-/i))
      .map((part) => part.trim()),
  );
}

export function canonicalComparePath(slugs: string[]) {
  const normalized = normalizeComparisonSlugs(slugs);

  return `/compare/${normalized.join("-vs-")}`;
}

export function isValidComparison(slugs: string[]) {
  return slugs.length >= MIN_COMPARE_PLUGINS && slugs.length <= MAX_COMPARE_PLUGINS;
}

export function parseCompactNumber(value: string) {
  const normalized = value.toLowerCase().replace("+", "").replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) return 0;
  if (normalized.endsWith("m")) return parsed * 1_000_000;
  if (normalized.endsWith("k")) return parsed * 1_000;

  return parsed;
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
