import type { Metadata } from "next";

export const SITE_NAME = "PluginScore";
export const DEFAULT_SEO_DESCRIPTION =
  "Search WordPress plugin audit scores, Plugin Check findings, rankings, categories, authors, installs, and repository metadata.";

type SeoMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  absoluteTitle?: boolean;
};

export function seoMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: SeoMetadataOptions): Metadata {
  const metaDescription = truncateText(description, 160);
  const socialDescription = truncateText(description, 200);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: metaDescription,
    alternates: path ? { canonical: path } : undefined,
    openGraph: {
      title,
      description: socialDescription,
      type: "website",
      url: path,
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary",
      title,
      description: socialDescription,
    },
  };
}

export function pluginScoreTitle(pluginName: string) {
  const name = cleanTitle(pluginName);
  const fullTitle = `${name} Plugin Score`;

  if (fullTitle.length <= 58) {
    return fullTitle;
  }

  return `${truncateTitle(name, 48)} Score`;
}

export function seoDisplayName(value: string) {
  return cleanTitle(value)
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map(formatTitlePart)
        .join("-"),
    )
    .join(" ");
}

export function truncateText(value: string, maxLength: number) {
  const cleaned = cleanTitle(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3).replace(/[\s,.;:!?-]+$/g, "")}...`;
}

function truncateTitle(value: string, maxLength: number) {
  const cleaned = cleanTitle(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxLength - 3).replace(/[\s,.;:!?-]+$/g, "");
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace >= 24) {
    return `${truncated.slice(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatTitlePart(value: string) {
  const lower = value.toLowerCase();
  const acronym = titleAcronyms[lower];

  if (acronym) {
    return acronym;
  }

  return lower ? `${lower[0]?.toUpperCase()}${lower.slice(1)}` : lower;
}

const titleAcronyms: Record<string, string> = {
  ai: "AI",
  api: "API",
  cdn: "CDN",
  crm: "CRM",
  css: "CSS",
  gdpr: "GDPR",
  html: "HTML",
  pdf: "PDF",
  php: "PHP",
  rss: "RSS",
  seo: "SEO",
  smtp: "SMTP",
  sms: "SMS",
  ssl: "SSL",
  svg: "SVG",
  url: "URL",
  wcag: "WCAG",
  woocommerce: "WooCommerce",
  wordpress: "WordPress",
  wp: "WP",
  xml: "XML",
};
