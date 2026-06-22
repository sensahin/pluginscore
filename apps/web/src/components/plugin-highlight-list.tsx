import {
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { PluginIcon } from "@/components/plugin-icon";
import { ScorePill } from "@/components/score-pill";
import { scoreDelta, type PluginSummary } from "@/lib/plugin-score-data";

export function PluginHighlightList({
  title,
  plugins,
  viewAllHref,
  viewAllLabel = "View all",
  metric = "installs",
}: {
  title: string;
  plugins: PluginSummary[];
  viewAllHref?: string;
  viewAllLabel?: string;
  metric?: "installs" | "downloads";
}) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-brand hover:text-brand-strong"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      <div className="divide-y divide-line">
        {plugins.map((plugin) => {
          const delta = scoreDelta(plugin);
          const DeltaIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight;

          return (
            <div
              key={plugin.slug}
              className="grid gap-3 p-4 transition hover:bg-surface-subtle sm:grid-cols-[1fr_auto]"
            >
              <div className="flex min-w-0 gap-3">
                <PluginIcon plugin={plugin} />
                <div className="min-w-0">
                  <Link
                    href={`/plugins/${plugin.slug}`}
                    prefetch={false}
                    className="block truncate font-semibold text-info hover:underline"
                  >
                    {plugin.name}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted">
                    <span>
                      {metric === "downloads"
                        ? `${plugin.downloads} downloads`
                        : `${plugin.activeInstalls} active installs`}
                    </span>
                    {plugin.topIssue ? <span> - {plugin.topIssue}</span> : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span
                  className={`inline-flex items-center gap-1 font-mono text-xs ${
                    delta >= 0 ? "text-good" : "text-risk"
                  }`}
                >
                  <DeltaIcon size={14} aria-hidden="true" />
                  {delta >= 0 ? "+" : ""}
                  {delta}
                </span>
                <ScorePill score={plugin.score} band={plugin.band} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
