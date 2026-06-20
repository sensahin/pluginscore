import Link from "next/link";
import { Download, Gauge, Package, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getTags } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "WordPress Plugin Tags",
  description:
    "Browse WordPress plugin tags with indexed plugin counts, audited plugin counts, installs, downloads, and average PluginScore results.",
  path: "/tags",
});

export default async function TagsPage() {
  const tags = await getTags(200);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">
          WordPress Plugin Tags
        </h1>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="divide-y divide-line">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${encodeURIComponent(tag.slug)}`}
              className="grid gap-3 p-4 transition hover:bg-surface-subtle md:grid-cols-[1fr_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-muted">
                  <Tag size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{tag.name}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {tag.pluginCount.toLocaleString()} plugin
                    {tag.pluginCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted md:justify-end">
                <span className="inline-flex items-center gap-1">
                  <Download size={14} aria-hidden="true" />
                  {formatCompact(tag.activeInstalls)} installs
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package size={14} aria-hidden="true" />
                  {tag.auditedPluginCount.toLocaleString()} audited
                </span>
                {tag.averageScore !== undefined ? (
                  <span className="inline-flex items-center gap-1 font-mono text-foreground">
                    <Gauge size={14} aria-hidden="true" />
                    {tag.averageScore}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}
