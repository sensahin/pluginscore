import { scoreBandLabel, type ScoreBand } from "@/lib/plugin-score-data";

const bandClassName: Record<ScoreBand, string> = {
  excellent: "border-good/30 bg-good/10 text-good",
  good: "border-info/30 bg-info/10 text-info",
  watch: "border-warn/30 bg-warn/10 text-warn",
  risk: "border-risk/30 bg-risk/10 text-risk",
};

export function ScorePill({
  score,
  band,
}: {
  score: number;
  band: ScoreBand;
}) {
  return (
    <span
      className={`inline-flex min-w-24 items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-sm font-semibold ${bandClassName[band]}`}
    >
      <span className="font-mono">{score}</span>
      <span>{scoreBandLabel(band)}</span>
    </span>
  );
}
