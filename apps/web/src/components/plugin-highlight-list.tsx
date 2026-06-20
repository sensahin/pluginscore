import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { PluginIcon } from "@/components/plugin-icon";
import { ScorePill } from "@/components/score-pill";
import { TagChips } from "@/components/tag-chips";
import { scoreDelta, type PluginSummary } from "@/lib/plugin-score-data";

export function PluginHighlightList({
  title,
  plugins,
  viewAllHref,
  viewAllLabel = "View all",
}: {
  title: string;
  plugins: PluginSummary[];
  viewAllHref?: string;
  viewAllLabel?: string;
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
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/plugins/${plugin.slug}`}
                      className="truncate font-semibold text-info hover:underline"
                    >
                      {plugin.name}
                    </Link>
                    {plugin.errors === 0 ? (
                      <CheckCircle2
                        size={16}
                        className="shrink-0 text-good"
                        aria-label="No errors"
                      />
                    ) : (
                      <AlertTriangle
                        size={16}
                        className="shrink-0 text-warn"
                        aria-label="Needs review"
                      />
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    <span>{plugin.activeInstalls} active installs</span>
                    {plugin.topIssue ? <span> - {plugin.topIssue}</span> : null}
                  </p>
                  <div className="mt-2">
                    <TagChips tags={plugin.tags} limit={3} size="xs" />
                  </div>
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
