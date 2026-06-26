import type { ScoreBand, ScoreBreakdown } from "@pluginscore/core";

export const pluginBadgeTypeOptions = [
  { id: "score", label: "Audit Score" },
  { id: "security", label: "Security Score" },
  { id: "performance", label: "Performance Score" },
  { id: "maintainability", label: "Maintainability" },
  { id: "repo", label: "Repository" },
  { id: "status", label: "Audit Status" },
  { id: "checked", label: "Checked by PluginScore" },
  { id: "report", label: "Open Audit Report" },
] as const;

export const pluginBadgeStyleOptions = [
  { id: "classic", label: "Classic" },
  { id: "pill", label: "Pill" },
  { id: "seal", label: "Seal" },
  { id: "compact", label: "Compact" },
] as const;

export const pluginBadgeThemeOptions = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
] as const;

export type PluginBadgeType = (typeof pluginBadgeTypeOptions)[number]["id"];
export type PluginBadgeStyle = (typeof pluginBadgeStyleOptions)[number]["id"];
export type PluginBadgeTheme = (typeof pluginBadgeThemeOptions)[number]["id"];
export type PluginBadgeTone = ScoreBand | "pending" | "missing" | "neutral";

export type PluginBadgeOptions = {
  type: PluginBadgeType;
  style: PluginBadgeStyle;
  theme: PluginBadgeTheme;
};

export type PluginBadgeContent = {
  label: string;
  value: string;
  title: string;
  tone: PluginBadgeTone;
  compactText?: string;
};

export type PluginBadgePlugin = {
  name: string;
  audited?: boolean;
  score: number;
  band: ScoreBand;
  scores?: ScoreBreakdown;
};

export const defaultPluginBadgeOptions: PluginBadgeOptions = {
  type: "score",
  style: "classic",
  theme: "dark",
};

const toneColor: Record<PluginBadgeTone, string> = {
  excellent: "#147a4d",
  good: "#2454a6",
  watch: "#a16207",
  risk: "#b3261e",
  pending: "#68707b",
  missing: "#68707b",
  neutral: "#3b596f",
};

const themePalette: Record<
  PluginBadgeTheme,
  {
    surface: string;
    surfaceSubtle: string;
    border: string;
    text: string;
    muted: string;
    labelText: string;
  }
> = {
  dark: {
    surface: "#17191c",
    surfaceSubtle: "#20242a",
    border: "#303741",
    text: "#ffffff",
    muted: "#c7ccd1",
    labelText: "#ffffff",
  },
  light: {
    surface: "#ffffff",
    surfaceSubtle: "#f4f6f8",
    border: "#d0d7de",
    text: "#17191c",
    muted: "#4b5563",
    labelText: "#17191c",
  },
};

const fontFamily =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export function parsePluginBadgeOptions(searchParams: URLSearchParams): PluginBadgeOptions {
  return {
    type: parseOption(searchParams.get("type"), pluginBadgeTypeOptions, defaultPluginBadgeOptions.type),
    style: parseOption(searchParams.get("style"), pluginBadgeStyleOptions, defaultPluginBadgeOptions.style),
    theme: parseOption(searchParams.get("theme"), pluginBadgeThemeOptions, defaultPluginBadgeOptions.theme),
  };
}

export function buildPluginBadgeContent(
  plugin: PluginBadgePlugin,
  options: Pick<PluginBadgeOptions, "type">,
): PluginBadgeContent {
  if (plugin.audited === false) {
    return {
      label: badgeLabel(options.type),
      value: "pending",
      title: `${plugin.name} audit pending`,
      tone: "pending",
      compactText: "Audit pending",
    };
  }

  if (options.type === "security") {
    return scoreContent(plugin, "Security", plugin.scores?.security ?? plugin.score);
  }

  if (options.type === "performance") {
    return scoreContent(plugin, "Performance", plugin.scores?.performance ?? plugin.score);
  }

  if (options.type === "maintainability") {
    return scoreContent(plugin, "Maintainability", plugin.scores?.maintainability ?? plugin.score);
  }

  if (options.type === "repo") {
    return scoreContent(plugin, "Repository", plugin.scores?.repo ?? plugin.score);
  }

  if (options.type === "status") {
    const value = statusValue(plugin.band);
    return {
      label: "Audit Status",
      value,
      title: `${plugin.name} audit status: ${value}`,
      tone: plugin.band,
      compactText: value,
    };
  }

  if (options.type === "checked") {
    return {
      label: "Checked by",
      value: "PluginScore",
      title: `${plugin.name} checked by PluginScore`,
      tone: "neutral",
      compactText: "PluginScore Checked",
    };
  }

  if (options.type === "report") {
    return {
      label: "Open Audit",
      value: "Report",
      title: `${plugin.name} PluginScore audit report`,
      tone: "neutral",
      compactText: "Open Audit Report",
    };
  }

  return scoreContent(plugin, "Audit Score", plugin.score);
}

export function renderPluginScoreBadge({
  content,
  options,
}: {
  content: PluginBadgeContent;
  options: PluginBadgeOptions;
}) {
  if (options.style === "pill") {
    return renderPillBadge(content, options.theme);
  }

  if (options.style === "seal") {
    return renderSealBadge(content, options.theme);
  }

  if (options.style === "compact") {
    return renderCompactBadge(content, options.theme);
  }

  return renderClassicBadge(content, options.theme);
}

export function pluginBadgeValue({
  audited,
  score,
}: {
  audited?: boolean;
  score: number;
}) {
  return audited === false ? "pending" : `${Math.floor(score)}/100`;
}

export function pluginBadgeTone({
  audited,
  band,
}: {
  audited?: boolean;
  band: ScoreBand;
}): PluginBadgeTone {
  return audited === false ? "pending" : band;
}

function scoreContent(plugin: PluginBadgePlugin, label: string, score: number): PluginBadgeContent {
  const value = `${Math.floor(score)}/100`;

  return {
    label,
    value,
    title: `${plugin.name} ${label.toLowerCase()} ${value}`,
    tone: toneFromScore(score),
    compactText: `${compactScoreLabel(label)} ${value}`,
  };
}

function badgeLabel(type: PluginBadgeType) {
  return pluginBadgeTypeOptions.find((option) => option.id === type)?.label ?? "Audit Score";
}

function compactScoreLabel(label: string) {
  if (label === "Audit Score") {
    return "Audit";
  }

  if (label === "Repository") {
    return "Repo";
  }

  return label;
}

function statusValue(band: ScoreBand) {
  if (band === "excellent") {
    return "Low Risk";
  }

  if (band === "good") {
    return "Good";
  }

  if (band === "watch") {
    return "Watch";
  }

  return "Needs Review";
}

function toneFromScore(score: number): PluginBadgeTone {
  if (score >= 90) {
    return "excellent";
  }

  if (score >= 80) {
    return "good";
  }

  if (score >= 65) {
    return "watch";
  }

  return "risk";
}

function renderClassicBadge(content: PluginBadgeContent, theme: PluginBadgeTheme) {
  const palette = themePalette[theme];
  const labelWidth = Math.max(82, estimateTextWidth(content.label, 11, 600) + 24);
  const valueWidth = Math.max(62, estimateTextWidth(content.value, 12, 800) + 24);
  const width = labelWidth + valueWidth;
  const height = 24;
  const valueX = labelWidth + valueWidth / 2;
  const tone = toneColor[content.tone];

  return svgShell(content.title, width, height, `
  <clipPath id="badge-clip">
    <rect width="${width}" height="${height}" rx="5"/>
  </clipPath>
  <g clip-path="url(#badge-clip)">
    <rect width="${labelWidth}" height="${height}" fill="${palette.surface}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${tone}"/>
  </g>
  <rect width="${width}" height="${height}" rx="5" fill="none" stroke="${palette.border}"/>
  <g font-family="${fontFamily}" text-rendering="geometricPrecision">
    <text x="12" y="16" fill="${palette.labelText}" font-size="11" font-weight="600">${escapeXml(content.label)}</text>
    <text x="${valueX}" y="16" fill="#ffffff" font-size="12" font-weight="800" text-anchor="middle">${escapeXml(content.value)}</text>
  </g>`);
}

function renderPillBadge(content: PluginBadgeContent, theme: PluginBadgeTheme) {
  const palette = themePalette[theme];
  const labelWidth = Math.max(86, estimateTextWidth(content.label, 12, 650) + 28);
  const valueWidth = Math.max(70, estimateTextWidth(content.value, 12, 800) + 26);
  const gap = 8;
  const width = labelWidth + valueWidth + gap + 8;
  const height = 30;
  const tone = toneColor[content.tone];
  const chipX = width - valueWidth - 4;
  const valueX = chipX + valueWidth / 2;

  return svgShell(content.title, width, height, `
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="15" fill="${palette.surface}" stroke="${palette.border}"/>
  <rect x="${chipX}" y="4" width="${valueWidth}" height="22" rx="11" fill="${tone}"/>
  <g font-family="${fontFamily}" text-rendering="geometricPrecision">
    <text x="14" y="19" fill="${palette.text}" font-size="12" font-weight="700">${escapeXml(content.label)}</text>
    <text x="${valueX}" y="19" fill="#ffffff" font-size="12" font-weight="800" text-anchor="middle">${escapeXml(content.value)}</text>
  </g>`);
}

function renderSealBadge(content: PluginBadgeContent, theme: PluginBadgeTheme) {
  const palette = themePalette[theme];
  const labelWidth = estimateTextWidth(content.label, 10, 700);
  const valueWidth = estimateTextWidth(content.value, 13, 800);
  const width = Math.max(168, Math.max(labelWidth, valueWidth) + 58);
  const height = 40;
  const tone = toneColor[content.tone];

  return svgShell(content.title, width, height, `
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${palette.surface}" stroke="${palette.border}"/>
  <circle cx="20" cy="20" r="10" fill="${tone}"/>
  <path d="M15.5 20.2l3 3 6.2-7" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <g font-family="${fontFamily}" text-rendering="geometricPrecision">
    <text x="38" y="16" fill="${palette.muted}" font-size="10" font-weight="700">${escapeXml(content.label)}</text>
    <text x="38" y="30" fill="${palette.text}" font-size="13" font-weight="800">${escapeXml(content.value)}</text>
  </g>`);
}

function renderCompactBadge(content: PluginBadgeContent, theme: PluginBadgeTheme) {
  const palette = themePalette[theme];
  const text = content.compactText ?? `${content.label} ${content.value}`;
  const textWidth = estimateTextWidth(text, 11, 800);
  const width = Math.max(84, textWidth + 22);
  const height = 22;
  const tone = toneColor[content.tone];
  const textFill = content.tone === "pending" || content.tone === "missing"
    ? palette.labelText
    : "#ffffff";

  return svgShell(content.title, width, height, `
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="11" fill="${content.tone === "pending" || content.tone === "missing" ? palette.surfaceSubtle : tone}" stroke="${content.tone === "pending" || content.tone === "missing" ? palette.border : tone}"/>
  <text x="${width / 2}" y="15" fill="${textFill}" font-family="${fontFamily}" font-size="11" font-weight="800" text-anchor="middle" text-rendering="geometricPrecision">${escapeXml(text)}</text>`);
}

function svgShell(title: string, width: number, height: number, body: string) {
  const escapedTitle = escapeXml(title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapedTitle}">
  <title>${escapedTitle}</title>${body}
</svg>`;
}

function estimateTextWidth(value: string, fontSize: number, weight = 600) {
  return Math.ceil(value.length * fontSize * 0.58 + (weight >= 700 ? value.length * 0.25 : 0));
}

function parseOption<T extends string>(
  value: string | null,
  options: readonly { id: T; label: string }[],
  fallback: T,
) {
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
