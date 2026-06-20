import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getPlugins } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "About PluginScore",
  description:
    "Learn how PluginScore indexes WordPress plugin scores, Plugin Check findings, rankings, issue pages, tags, and repository metadata.",
  path: "/about",
  absoluteTitle: true,
});

export const revalidate = 1_800;

export default async function AboutPage() {
  const indexedPlugins = await getPlugins({ limit: 500, sort: "updated_desc" });
  const indexedLabel =
    indexedPlugins.length >= 500
      ? "500+"
      : indexedPlugins.length.toLocaleString();

  return (
    <AppShell>
      <article className="rounded-md border border-line bg-surface p-5">
        <p className="text-sm font-medium text-brand">About</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal">
          A public audit index for WordPress plugins
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          PluginScore turns WordPress Plugin Check output into searchable plugin
          profiles, rankings, issue pages, and score history. The goal is to make
          plugin quality signals easier to compare without replacing human code
          review.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">Index</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {indexedLabel} plugins are indexed in the current public data set.
              Backfill continues toward the top 1000 WordPress.org plugins.
            </p>
          </section>
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">Scope</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The MVP uses official WordPress.org ZIPs and static Plugin Check
              signals. Runtime sandbox checks can be added later as a separate
              tier.
            </p>
          </section>
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">Open Source</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The codebase is structured for GitHub publication with scanner,
              API, scheduler, scoring, and UI packages kept separate.
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/methodology"
            className="inline-flex h-10 items-center rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
          >
            Read methodology
          </Link>
          <Link
            href="/rankings"
            className="inline-flex h-10 items-center rounded-md bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Browse rankings
          </Link>
        </div>
      </article>
    </AppShell>
  );
}
