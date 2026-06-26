"use client";

import { CheckCircle2, Code2, Copy } from "lucide-react";
import { useState } from "react";
import {
  defaultPluginBadgeOptions,
  pluginBadgeStyleOptions,
  pluginBadgeThemeOptions,
  pluginBadgeTypeOptions,
  type PluginBadgeStyle,
  type PluginBadgeTheme,
  type PluginBadgeType,
} from "@/lib/plugin-badge";

const siteUrl = "https://pluginscore.com";

type CopyTarget = "url" | "html" | "markdown";

export function PluginBadgeCard({
  pluginSlug,
  pluginName,
}: {
  pluginSlug: string;
  pluginName: string;
}) {
  const [type, setType] = useState<PluginBadgeType>(defaultPluginBadgeOptions.type);
  const [style, setStyle] = useState<PluginBadgeStyle>(defaultPluginBadgeOptions.style);
  const [theme, setTheme] = useState<PluginBadgeTheme>(defaultPluginBadgeOptions.theme);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [error, setError] = useState("");
  const selectedType = pluginBadgeTypeOptions.find((option) => option.id === type) ?? pluginBadgeTypeOptions[0];
  const badgePath = buildBadgePath(pluginSlug, { type, style, theme });
  const badgeUrl = `${siteUrl}${badgePath}`;
  const pluginUrl = `${siteUrl}/plugins/${encodeURIComponent(pluginSlug)}`;
  const altText = `${pluginName} ${selectedType.label}`;
  const html = `<a href="${pluginUrl}"><img src="${badgeUrl}" alt="${escapeHtmlAttribute(altText)}"></a>`;
  const markdown = `[![${escapeMarkdownAlt(altText)}](${badgeUrl})](${pluginUrl})`;

  async function copy(value: string, target: CopyTarget) {
    setError("");

    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
    } catch {
      setCopied(null);
      setError("Copy failed");
    }
  }

  return (
    <aside className="rounded-md border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">Badge</h2>
        <Code2 size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      </div>

      <a
        href={`/plugins/${encodeURIComponent(pluginSlug)}`}
        className="mt-4 flex min-h-16 items-center justify-center rounded-md border border-line bg-background px-3 py-3 transition hover:bg-surface-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badgePath}
          alt={altText}
          className="max-w-full"
          loading="lazy"
          decoding="async"
        />
      </a>

      <div className="mt-4 grid gap-3">
        <BadgeSelect
          label="Type"
          value={type}
          options={pluginBadgeTypeOptions}
          onChange={setType}
        />
        <div className="grid grid-cols-2 gap-3">
          <BadgeSelect
            label="Style"
            value={style}
            options={pluginBadgeStyleOptions}
            onChange={setStyle}
          />
          <BadgeSelect
            label="Theme"
            value={theme}
            options={pluginBadgeThemeOptions}
            onChange={setTheme}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <CopyButton
          copied={copied === "url"}
          label="Copy URL"
          onClick={() => copy(badgeUrl, "url")}
        />
        <CopyButton
          copied={copied === "html"}
          label="Copy HTML"
          onClick={() => copy(html, "html")}
        />
        <CopyButton
          copied={copied === "markdown"}
          label="Copy Markdown"
          onClick={() => copy(markdown, "markdown")}
        />
      </div>

      {error ? <p className="mt-3 text-xs text-risk">{error}</p> : null}
    </aside>
  );
}

function BadgeSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 w-full rounded-md border border-line bg-background px-2 text-sm text-foreground outline-none transition focus:border-brand"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyButton({
  copied,
  label,
  onClick,
}: {
  copied: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = copied ? CheckCircle2 : Copy;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-2 text-sm font-semibold transition hover:bg-surface-subtle"
    >
      <Icon size={15} aria-hidden="true" />
      <span className="truncate">{copied ? "Copied" : label}</span>
    </button>
  );
}

function buildBadgePath(
  pluginSlug: string,
  options: {
    type: PluginBadgeType;
    style: PluginBadgeStyle;
    theme: PluginBadgeTheme;
  },
) {
  const params = new URLSearchParams();

  if (options.type !== defaultPluginBadgeOptions.type) {
    params.set("type", options.type);
  }

  if (options.style !== defaultPluginBadgeOptions.style) {
    params.set("style", options.style);
  }

  if (options.theme !== defaultPluginBadgeOptions.theme) {
    params.set("theme", options.theme);
  }

  const query = params.toString();
  return `/badges/${encodeURIComponent(pluginSlug)}.svg${query ? `?${query}` : ""}`;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeMarkdownAlt(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
