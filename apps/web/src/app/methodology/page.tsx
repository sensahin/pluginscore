import { AppShell } from "@/components/app-shell";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "PluginScore Methodology",
  description:
    "How PluginScore converts WordPress Plugin Check findings, severity, issue families, and repeat counts into public WordPress plugin scores.",
  path: "/methodology",
  absoluteTitle: true,
});

export default function MethodologyPage() {
  return (
    <AppShell>
      <article className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">Methodology</h1>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">Input</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              PluginScore scans official WordPress.org ZIP downloads with a
              pinned version of WordPress Plugin Check. The MVP uses static
              checks only.
            </p>
          </section>
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">Penalty</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Findings are grouped by stable code, weighted by issue family and
              severity, then capped with a square-root repeat penalty.
            </p>
          </section>
          <section className="rounded-md border border-line bg-background p-4">
            <h2 className="text-base font-semibold">History</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Every version change, Plugin Check version change, and scoring
              model change creates a new score snapshot.
            </p>
          </section>
        </div>
        <div className="mt-6 rounded-md border border-line bg-background p-4">
          <p className="font-mono text-sm">
            PluginScore = 100 - min(100, sum(code_weight * type_weight *
            severity_factor * sqrt(deduped_count)))
          </p>
        </div>
      </article>
    </AppShell>
  );
}
