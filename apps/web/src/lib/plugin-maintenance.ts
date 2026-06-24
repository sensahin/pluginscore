import type { PluginSummary } from "@pluginscore/core";
import { formatExactDate, formatRelativeDate } from "@/lib/formatting";

export type PluginMaintenanceTone = "good" | "info" | "warn" | "risk" | "muted";

export type PluginMaintenanceSignal = {
  label: "Active" | "Mostly active" | "Needs attention" | "Stale signals" | "Unknown";
  tone: PluginMaintenanceTone;
  title: string;
};

const DEFAULT_WORDPRESS_REFERENCE_VERSION = "7.0";
const DAY_MS = 86_400_000;

export function getPluginMaintenanceSignal(
  plugin: Pick<PluginSummary, "lastUpdated" | "testedWp" | "requiresWp" | "requiresPhp">,
  referenceDate = new Date(),
): PluginMaintenanceSignal {
  const referenceWpVersion =
    process.env.NEXT_PUBLIC_WORDPRESS_REFERENCE_VERSION ??
    DEFAULT_WORDPRESS_REFERENCE_VERSION;
  const updatedDaysAgo = daysSince(plugin.lastUpdated, referenceDate);
  const testedGap = wordpressVersionGap(plugin.testedWp, referenceWpVersion);
  const requiresPhpVersion = parseVersion(plugin.requiresPhp);
  const requiresWpVersion = parseVersion(plugin.requiresWp);

  const positives: string[] = [];
  const mildSignals: string[] = [];
  const concernSignals: string[] = [];
  const strongSignals: string[] = [];
  const contextSignals: string[] = [];

  if (updatedDaysAgo === undefined) {
    concernSignals.push("missing update date");
  } else if (updatedDaysAgo <= 365) {
    positives.push("updated within the last year");
  } else if (updatedDaysAgo <= 730) {
    mildSignals.push("not updated in over a year");
  } else if (updatedDaysAgo <= 1_095) {
    concernSignals.push("not updated in over two years");
  } else {
    strongSignals.push("not updated in over three years");
  }

  if (!plugin.testedWp) {
    concernSignals.push("missing tested-up-to version");
  } else if (testedGap !== undefined && testedGap <= 1) {
    positives.push(`tested close to WordPress ${referenceWpVersion}`);
  } else if (testedGap !== undefined && testedGap <= 3) {
    mildSignals.push(`tested-up-to is behind WordPress ${referenceWpVersion}`);
  } else if (testedGap !== undefined) {
    strongSignals.push(`tested-up-to is far behind WordPress ${referenceWpVersion}`);
  }

  if (requiresPhpVersion && compareVersions(requiresPhpVersion, [5, 6]) <= 0) {
    contextSignals.push("supports a legacy PHP baseline");
  }

  if (requiresWpVersion && compareVersions(requiresWpVersion, [5, 0]) <= 0) {
    contextSignals.push("supports an older WordPress baseline");
  }

  const label = maintenanceLabel({
    positives: positives.length,
    mild: mildSignals.length,
    concerns: concernSignals.length,
    strong: strongSignals.length,
  });

  return {
    label,
    tone: maintenanceTone(label),
    title: maintenanceTitle(plugin, {
      referenceWpVersion,
      positives,
      mildSignals,
      concernSignals,
      strongSignals,
      contextSignals,
    }),
  };
}

function maintenanceLabel({
  positives,
  mild,
  concerns,
  strong,
}: {
  positives: number;
  mild: number;
  concerns: number;
  strong: number;
}): PluginMaintenanceSignal["label"] {
  if (positives === 0 && mild === 0 && concerns === 0 && strong === 0) {
    return "Unknown";
  }

  if (strong >= 2 || (strong >= 1 && concerns >= 1)) {
    return "Stale signals";
  }

  if (strong >= 1 || concerns >= 2) {
    return "Needs attention";
  }

  if (concerns >= 1 || mild >= 2) {
    return "Mostly active";
  }

  return "Active";
}

function maintenanceTone(label: PluginMaintenanceSignal["label"]): PluginMaintenanceTone {
  switch (label) {
    case "Active":
      return "good";
    case "Mostly active":
      return "info";
    case "Needs attention":
      return "warn";
    case "Stale signals":
      return "risk";
    case "Unknown":
      return "muted";
  }
}

function maintenanceTitle(
  plugin: Pick<PluginSummary, "lastUpdated" | "testedWp" | "requiresWp" | "requiresPhp">,
  {
    referenceWpVersion,
    positives,
    mildSignals,
    concernSignals,
    strongSignals,
    contextSignals,
  }: {
    referenceWpVersion: string;
    positives: string[];
    mildSignals: string[];
    concernSignals: string[];
    strongSignals: string[];
    contextSignals: string[];
  },
) {
  const facts = [
    `Last updated: ${dateSummary(plugin.lastUpdated)}`,
    `Tested up to: ${plugin.testedWp ?? "Unknown"}`,
    `Requires WP: ${plugin.requiresWp ?? "Unknown"}`,
    `Requires PHP: ${plugin.requiresPhp ?? "Unknown"}`,
    `Reference WP: ${referenceWpVersion}`,
  ];
  const signals = [...strongSignals, ...concernSignals, ...mildSignals, ...positives];
  const context = contextSignals.length ? ` Context: ${contextSignals.join("; ")}.` : "";

  return [
    "Maintenance freshness signal, not a definitive status label.",
    ...facts,
    signals.length
      ? `Signals: ${signals.join("; ")}.${context}`
      : `Signals: not enough metadata.${context}`,
  ].join("\n");
}

function dateSummary(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return `${formatRelativeDate(value)} (${formatExactDate(value)})`;
}

function daysSince(value?: string, referenceDate = new Date()) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const dateDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const referenceDay = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  return Math.max(0, Math.round((referenceDay - dateDay) / DAY_MS));
}

function wordpressVersionGap(value: string | undefined, reference: string) {
  const version = parseVersion(value);
  const referenceVersion = parseVersion(reference);

  if (!version || !referenceVersion) {
    return undefined;
  }

  return Math.max(0, versionToComparable(referenceVersion) - versionToComparable(version));
}

function parseVersion(value?: string): [number, number] | null {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)(?:\.(\d+))?/);

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2] ?? 0)];
}

function versionToComparable(version: [number, number]) {
  return version[0] * 100 + version[1];
}

function compareVersions(left: [number, number], right: [number, number]) {
  return versionToComparable(left) - versionToComparable(right);
}
