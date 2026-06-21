import type { PluginSummary } from "@pluginscore/core";
import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const ogImageSize = {
  width: 1200,
  height: 630,
};

type OgImageStat = {
  label: string;
  value: string;
};

type OgImageOptions = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  score?: number;
  band?: PluginSummary["band"];
  iconUrl?: string;
  iconFallback?: string;
  stats?: OgImageStat[];
};

const colors = {
  background: "#f6f7f8",
  foreground: "#17191c",
  muted: "#68707b",
  surface: "#ffffff",
  subtle: "#eef1f3",
  line: "#d9dee3",
  brand: "#17191c",
  brandStrong: "#17191c",
  good: "#147a4d",
  info: "#2454a6",
  warn: "#a16207",
  risk: "#b3261e",
};

const bandColor: Record<PluginSummary["band"], string> = {
  excellent: colors.good,
  good: colors.info,
  watch: colors.warn,
  risk: colors.risk,
};

export function createOgImage({
  eyebrow = "PluginScore",
  title,
  subtitle,
  score,
  band = "good",
  iconUrl,
  iconFallback = "P",
  stats = [],
}: OgImageOptions) {
  const scoreColor = score === undefined ? colors.brand : bandColor[band];
  const safeIconUrl = safeRasterImageUrl(iconUrl);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 64,
          background: colors.background,
          color: colors.foreground,
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: `1px solid ${colors.line}`,
            borderRadius: 24,
            background: colors.surface,
            padding: 46,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 32,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 60,
                  height: 60,
                }}
              >
                <BrandMark width={60} height={60} />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: colors.brandStrong,
                    fontSize: 26,
                    fontWeight: 800,
                  }}
                >
                  PluginScore
                </div>
                <div
                  style={{
                    display: "flex",
                    color: colors.muted,
                    fontSize: 20,
                    fontWeight: 500,
                  }}
                >
                  WordPress plugin scores
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: colors.muted,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              pluginscore.com
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 44,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
                gap: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  border: `1px solid ${colors.line}`,
                  borderRadius: 999,
                  background: colors.subtle,
                  color: colors.muted,
                  padding: "10px 18px",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {truncateText(eyebrow, 56)}
              </div>
              <div
                style={{
                  display: "flex",
                  color: colors.foreground,
                  fontSize: title.length > 42 ? 56 : 64,
                  fontWeight: 850,
                  lineHeight: 1.04,
                  letterSpacing: 0,
                  maxWidth: 700,
                }}
              >
                {truncateText(title, 68)}
              </div>
              {subtitle ? (
                <div
                  style={{
                    display: "flex",
                    color: colors.muted,
                    fontSize: 27,
                    lineHeight: 1.35,
                    maxWidth: 700,
                  }}
                >
                  {truncateText(subtitle, 118)}
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 250,
                minWidth: 250,
                gap: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 118,
                  height: 118,
                  borderRadius: 26,
                  border: `1px solid ${colors.line}`,
                  background: colors.subtle,
                  color: colors.brandStrong,
                  overflow: "hidden",
                  fontSize: 48,
                  fontWeight: 850,
                }}
              >
                {safeIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeIconUrl}
                    alt=""
                    width="118"
                    height="118"
                    style={{ width: 118, height: 118 }}
                  />
                ) : (
                  truncateText(iconFallback, 2).toUpperCase()
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 180,
                  height: 180,
                  borderRadius: 999,
                  border: `14px solid ${scoreColor}`,
                  background: "#ffffff",
                  color: scoreColor,
                  fontSize: 74,
                  fontWeight: 900,
                }}
              >
                {score === undefined ? "--" : Math.round(score)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 14,
            }}
          >
            {stats.slice(0, 4).map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  border: `1px solid ${colors.line}`,
                  borderRadius: 16,
                  background: colors.subtle,
                  padding: "18px 20px",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: colors.muted,
                    fontSize: 18,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {truncateText(stat.label, 22)}
                </div>
                <div
                  style={{
                    display: "flex",
                    color: colors.foreground,
                    fontSize: 30,
                    fontWeight: 850,
                  }}
                >
                  {truncateText(stat.value, 32)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    ogImageSize,
  );
}

export function pluginToOgImage(plugin: PluginSummary) {
  return createOgImage({
    eyebrow: plugin.audited ? "Plugin Score" : "Plugin Scan Pending",
    title: `${plugin.name} Plugin Score`,
    subtitle: plugin.shortDescription ?? `${plugin.name} on PluginScore.`,
    score: plugin.audited ? plugin.score : undefined,
    band: plugin.band,
    iconUrl: plugin.iconUrl,
    iconFallback: plugin.name.trim().slice(0, 1) || "P",
    stats: [
      { label: "Installs", value: plugin.activeInstalls },
      { label: "Findings", value: plugin.audited ? plugin.findings.toLocaleString() : "Pending" },
      { label: "Errors", value: plugin.audited ? plugin.errors.toLocaleString() : "Pending" },
      { label: "Updated", value: plugin.lastUpdated },
    ],
  });
}

export function defaultOgImage() {
  return createOgImage({
    title: "WordPress Plugin Scores",
    subtitle: "Search Plugin Check audit scores, findings, rankings, categories, authors, installs, and repository metadata.",
    stats: [
      { label: "Rankings", value: "Scores" },
      { label: "Signals", value: "Findings" },
      { label: "Directory", value: "Metadata" },
      { label: "Project", value: "Open Source" },
    ],
  });
}

function truncateText(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3).replace(/[\s,.;:!?-]+$/g, "")}...`;
}

function safeRasterImageUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }

    if (pathname.endsWith(".svg") || pathname.endsWith(".gif")) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
