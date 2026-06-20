import type { ScoreBand } from "@pluginscore/core";

const badgeClassName: Record<ScoreBand, string> = {
  excellent: "bg-good text-white border-good",
  good: "bg-info text-white border-info",
  watch: "bg-warn/10 text-warn border-warn/30",
  risk: "bg-risk text-white border-risk",
};

export function ScoreBadge({
  score,
  band,
}: {
  score: number;
  band: ScoreBand;
}) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-md border px-2 py-1 font-mono text-xs font-semibold ${badgeClassName[band]}`}
    >
      {Math.floor(score)}
    </span>
  );
}
