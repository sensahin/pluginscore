"use client";

import { CheckCircle2, Code2, Copy } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const siteUrl = "https://pluginscore.com";

type CopyTarget = "html" | "markdown";

export function PluginBadgeCard({
  pluginSlug,
  pluginName,
}: {
  pluginSlug: string;
  pluginName: string;
}) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [error, setError] = useState("");
  const badgePath = `/badges/${encodeURIComponent(pluginSlug)}.svg`;
  const badgeUrl = `${siteUrl}${badgePath}`;
  const pluginUrl = `${siteUrl}/plugins/${encodeURIComponent(pluginSlug)}`;
  const altText = `${pluginName} PluginScore`;
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
        className="mt-4 flex min-h-12 items-center rounded-md border border-line bg-background px-3 transition hover:bg-surface-subtle"
      >
        <Image
          src={badgePath}
          width={158}
          height={24}
          alt={altText}
          unoptimized
        />
      </a>

      <div className="mt-4 grid grid-cols-2 gap-2">
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
