import type { ScoreBand } from "@pluginscore/core";

export type PluginBadgeTone = ScoreBand | "pending" | "missing";

const toneColor: Record<PluginBadgeTone, string> = {
  excellent: "#147a4d",
  good: "#2454a6",
  watch: "#a16207",
  risk: "#b3261e",
  pending: "#68707b",
  missing: "#68707b",
};

export function renderPluginScoreBadge({
  value,
  tone,
  title,
}: {
  value: string;
  tone: PluginBadgeTone;
  title: string;
}) {
  const label = "PluginScore";
  const labelWidth = 94;
  const valueWidth = 64;
  const width = labelWidth + valueWidth;
  const escapedTitle = escapeXml(title);
  const escapedLabel = escapeXml(label);
  const escapedValue = escapeXml(value);
  const valueX = labelWidth + valueWidth / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24" viewBox="0 0 ${width} 24" role="img" aria-label="${escapedTitle}">
  <title>${escapedTitle}</title>
  <clipPath id="badge-clip">
    <rect width="${width}" height="24" rx="5"/>
  </clipPath>
  <g clip-path="url(#badge-clip)">
    <rect width="${labelWidth}" height="24" fill="#17191c"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="24" fill="${toneColor[tone]}"/>
  </g>
  <g fill="#ffffff" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" text-rendering="geometricPrecision">
    <text x="12" y="16" font-size="11" font-weight="600">${escapedLabel}</text>
    <text x="${valueX}" y="16" font-size="12" font-weight="800" text-anchor="middle">${escapedValue}</text>
  </g>
</svg>`;
}

export function pluginBadgeValue({
  audited,
  score,
}: {
  audited?: boolean;
  score: number;
}) {
  return audited === false ? "pending" : String(Math.floor(score));
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
