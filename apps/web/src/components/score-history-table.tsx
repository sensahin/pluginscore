"use client";

import type { PluginScoreHistoryPoint } from "@pluginscore/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { RelativeDate } from "@/components/relative-date";

export function ScoreHistoryTable({ points }: { points: PluginScoreHistoryPoint[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const newestFirst = [...points].reverse();
  const hiddenCount = Math.max(0, newestFirst.length - 2);
  const visiblePoints = isExpanded ? newestFirst : newestFirst.slice(0, 2);
  const hasMore = hiddenCount > 0;

  return (
    <div>
      <div className="space-y-3 sm:hidden">
        {visiblePoints.map((point, index) => (
          <ScoreHistoryCard key={point.auditRunId} point={point} isLatest={index === 0} />
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[680px] w-full table-fixed border-collapse overflow-hidden rounded-md border border-line text-sm">
          <ScoreHistoryColGroup />
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-32 px-3 py-3 font-medium">Scan</th>
              <th className="w-20 px-3 py-3 text-right font-medium">Score</th>
              <th className="w-28 px-3 py-3 text-right font-medium">Findings</th>
              <th className="w-24 px-3 py-3 text-right font-medium">Errors</th>
              <th className="w-24 px-3 py-3 text-right font-medium">Warnings</th>
              <th className="px-3 py-3 font-medium">Plugin</th>
              <th className="px-3 py-3 font-medium">Check</th>
            </tr>
          </thead>
          <tbody>
            {visiblePoints.map((point, index) => (
              <ScoreHistoryRow key={point.auditRunId} point={point} isLatest={index === 0} />
            ))}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "Show less" : `Show ${hiddenCount.toLocaleString()} more`}
            <ChevronDown
              size={16}
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ScoreHistoryColGroup() {
  return (
    <colgroup>
      <col className="w-32" />
      <col className="w-20" />
      <col className="w-28" />
      <col className="w-24" />
      <col className="w-24" />
      <col />
      <col />
    </colgroup>
  );
}

function ScoreHistoryCard({
  point,
  isLatest = false,
}: {
  point: PluginScoreHistoryPoint;
  isLatest?: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            <RelativeDate value={point.scannedAt} />
          </p>
          <p className="mt-1 font-mono text-xs text-muted">v{point.pluginVersion}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold">{point.score}</p>
          <p className="text-xs text-muted">{isLatest ? "Latest" : "Score"}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <HistoryMeta label="Findings" value={point.findings.toLocaleString()} />
        <HistoryMeta label="Errors" value={point.errors.toLocaleString()} />
        <HistoryMeta label="Warnings" value={point.warnings.toLocaleString()} />
        <HistoryMeta label="Check" value={point.pluginCheckVersion} />
      </dl>
    </div>
  );
}

function ScoreHistoryRow({
  point,
  isLatest = false,
}: {
  point: PluginScoreHistoryPoint;
  isLatest?: boolean;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-4">
        <span className="block font-medium">
          <RelativeDate value={point.scannedAt} />
        </span>
        {isLatest ? <span className="mt-1 block text-xs text-muted">Latest</span> : null}
      </td>
      <td className="px-3 py-4 text-right font-mono font-semibold">{point.score}</td>
      <td className="px-3 py-4 text-right font-mono">{point.findings.toLocaleString()}</td>
      <td className="px-3 py-4 text-right font-mono">{point.errors.toLocaleString()}</td>
      <td className="px-3 py-4 text-right font-mono">{point.warnings.toLocaleString()}</td>
      <td className="break-all px-3 py-4 font-mono text-xs">v{point.pluginVersion}</td>
      <td className="break-all px-3 py-4 font-mono text-xs">{point.pluginCheckVersion}</td>
    </tr>
  );
}

function HistoryMeta({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-foreground">{value}</dd>
    </div>
  );
}
