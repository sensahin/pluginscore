import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PluginIcon } from "@/components/plugin-icon";
import { ScoreBadge } from "@/components/score-badge";
import { TagChips } from "@/components/tag-chips";
import type { PluginSummary } from "@/lib/plugin-score-data";

export function PluginListTable({
  plugins,
  showRank = true,
  rankOffset = 0,
  emptyLabel = "No results.",
}: {
  plugins: PluginSummary[];
  showRank?: boolean;
  rankOffset?: number;
  emptyLabel?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              {showRank ? <th className="w-20 px-4 py-3 font-medium">Rank</th> : null}
              <th className="px-4 py-3 font-medium">Plugin</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="px-4 py-3 text-right font-medium">Errors</th>
              <th className="px-4 py-3 text-right font-medium">Warnings</th>
              <th className="px-4 py-3 text-right font-medium">Installs</th>
              <th className="px-4 py-3 text-right font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Top Issue</th>
            </tr>
          </thead>
          <tbody>
            {plugins.length > 0 ? (
              plugins.map((plugin, index) => (
                <tr
                  key={plugin.slug}
                  className="border-b border-line last:border-b-0 transition hover:bg-surface-subtle/70"
                >
                  {showRank ? (
                    <td className="px-4 py-4 font-medium text-muted">#{rankOffset + index + 1}</td>
                  ) : null}
                  <td className="px-4 py-4">
                    <Link
                      href={`/plugins/${plugin.slug}`}
                      prefetch={false}
                      className="group flex min-w-0 items-center gap-2"
                    >
                      <PluginIcon plugin={plugin} size="xs" />
                      <span
                        className="block max-w-[32ch] truncate font-medium text-info group-hover:underline md:max-w-[46ch]"
                        title={plugin.name}
                      >
                        {plugin.name}
                      </span>
                    </Link>
                    <div className="mt-2">
                      <TagChips tags={plugin.tags} limit={3} size="xs" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {plugin.audited === false ? (
                      <span className="inline-flex rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-semibold text-muted">
                        Pending
                      </span>
                    ) : (
                      <ScoreBadge score={plugin.score} band={plugin.band} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {plugin.audited === false ? (
                      <span className="text-muted">-</span>
                    ) : plugin.errors === 0 ? (
                      <CheckCircle2
                        size={18}
                        className="ml-auto text-good"
                        aria-label="No errors"
                      />
                    ) : (
                      plugin.errors.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {plugin.audited === false ? (
                      <span className="text-muted">-</span>
                    ) : (
                      plugin.warnings.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {plugin.activeInstalls}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-xs text-muted">
                    {plugin.lastUpdated}
                  </td>
                  <td className="max-w-[28ch] truncate px-4 py-4 text-muted">
                    {plugin.audited === false ? "Pending scan" : plugin.topIssue}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={showRank ? 8 : 7}
                  className="h-24 px-4 py-8 text-center text-muted"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
