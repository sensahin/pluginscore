import Link from "next/link";
import { Download, Package, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAuthors } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "WordPress Plugin Authors",
  description:
    "Browse WordPress plugin authors by indexed plugins, audited plugins, active installs, downloads, findings, and average PluginScore results.",
  path: "/authors",
});

export default async function AuthorsPage() {
  const authors = await getAuthors(100);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">
          WordPress Plugin Authors
        </h1>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="divide-y divide-line">
          {authors.map((author) => (
            <Link
              key={author.name}
              href={`/authors/${encodeURIComponent(author.name)}`}
              className="grid gap-3 p-4 transition hover:bg-surface-subtle md:grid-cols-[1fr_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-subtle text-muted">
                  <User size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{author.name}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {author.pluginCount.toLocaleString()} plugin
                    {author.pluginCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted md:justify-end">
                <span className="inline-flex items-center gap-1">
                  <Download size={14} aria-hidden="true" />
                  {formatCompact(author.activeInstalls)} installs
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package size={14} aria-hidden="true" />
                  {author.auditedPluginCount.toLocaleString()} audited
                </span>
                {author.averageScore !== undefined ? (
                  <span className="font-mono text-foreground">
                    {author.averageScore}/100
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
