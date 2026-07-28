import type {
  OperationsStorageSnapshot,
  OperationsSummary,
} from "@pluginscore/core";

type StorageMetricKey = Exclude<keyof OperationsStorageSnapshot, "capturedAt">;
type StorageSummary = OperationsSummary["storage"];

type StorageMetric = {
  key: StorageMetricKey;
  label: string;
  format: "bytes" | "number";
};

const storageMetrics: StorageMetric[] = [
  { key: "databaseBytes", label: "Database", format: "bytes" },
  { key: "auditFindingsBytes", label: "Findings table", format: "bytes" },
  { key: "auditRunsBytes", label: "Audit runs", format: "bytes" },
  { key: "rawReportJsonBytes", label: "Raw reports", format: "bytes" },
  { key: "totalFindingRows", label: "Finding rows", format: "number" },
  {
    key: "p90FindingsPerStoredAudit",
    label: "p90 findings/audit",
    format: "number",
  },
];

export function StorageGrowthTable({ storage }: { storage: StorageSummary }) {
  const firstSnapshot = storage.history[0];

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="py-3 pr-4 font-semibold">Metric</th>
              <th className="px-4 py-3 text-right font-semibold">Current</th>
              <th className="px-4 py-3 text-right font-semibold">24h</th>
              <th className="px-4 py-3 text-right font-semibold">7d</th>
              <th className="px-4 py-3 text-right font-semibold">30d</th>
              <th className="py-3 pl-4 text-right font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody>
            {storageMetrics.map((metric) => {
              const current = getCurrentValue(storage, metric.key);

              return (
                <tr key={metric.key} className="border-b border-line last:border-b-0">
                  <th className="py-3 pr-4 text-left font-medium">{metric.label}</th>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatMetricValue(current, metric.format)}
                  </td>
                  <StorageDeltaCell
                    current={current}
                    baseline={findBaseline(storage.history, metric.key, 24)}
                    format={metric.format}
                  />
                  <StorageDeltaCell
                    current={current}
                    baseline={findBaseline(storage.history, metric.key, 24 * 7)}
                    format={metric.format}
                  />
                  <StorageDeltaCell
                    current={current}
                    baseline={findBaseline(storage.history, metric.key, 24 * 30)}
                    format={metric.format}
                  />
                  <td className="py-3 pl-4">
                    <StorageSparkline
                      history={storage.history}
                      metric={metric}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        {firstSnapshot
          ? `Hourly tracking started ${formatSnapshotDate(firstSnapshot.capturedAt)}.`
          : "Hourly tracking will begin with the next storage snapshot."}{" "}
        Changes appear once enough matching history has been collected.
      </p>
    </>
  );
}

function StorageDeltaCell({
  current,
  baseline,
  format,
}: {
  current: number;
  baseline?: number;
  format: StorageMetric["format"];
}) {
  if (baseline === undefined) {
    return (
      <td className="px-4 py-3 text-right text-xs text-muted">
        Collecting
      </td>
    );
  }

  const delta = current - baseline;
  const percentage = baseline > 0 ? (delta / baseline) * 100 : undefined;

  return (
    <td className="px-4 py-3 text-right">
      <span className="block font-mono font-medium">
        {formatMetricDelta(delta, format)}
      </span>
      <span className="mt-0.5 block font-mono text-xs text-muted">
        {formatPercentage(percentage)}
      </span>
    </td>
  );
}

function StorageSparkline({
  history,
  metric,
}: {
  history: OperationsStorageSnapshot[];
  metric: StorageMetric;
}) {
  if (history.length < 2) {
    return <span className="block text-right text-xs text-muted">Collecting</span>;
  }

  const width = 112;
  const height = 32;
  const padding = 2;
  const values = history.map((snapshot) => snapshot[metric.key]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  const points = values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = range === 0
        ? height / 2
        : padding + ((maximum - value) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const finalPoint = points.split(" ").at(-1)?.split(",") ?? [];

  return (
    <svg
      className="ml-auto h-8 w-28 text-brand"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${metric.label} trend over the last 31 days`}
    >
      <title>{metric.label} trend over the last 31 days</title>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {finalPoint.length === 2 ? (
        <circle
          cx={finalPoint[0]}
          cy={finalPoint[1]}
          r="2.5"
          fill="currentColor"
        />
      ) : null}
    </svg>
  );
}

function findBaseline(
  history: OperationsStorageSnapshot[],
  key: StorageMetricKey,
  hoursAgo: number,
) {
  const latest = history.at(-1);
  if (!latest) {
    return undefined;
  }

  const target = new Date(latest.capturedAt).getTime() - hoursAgo * 60 * 60 * 1000;
  const toleranceHours = hoursAgo <= 24 ? 12 : hoursAgo <= 24 * 7 ? 36 : 72;
  let closest: OperationsStorageSnapshot | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const snapshot of history) {
    const distance = Math.abs(new Date(snapshot.capturedAt).getTime() - target);
    if (distance < closestDistance) {
      closest = snapshot;
      closestDistance = distance;
    }
  }

  if (closestDistance > toleranceHours * 60 * 60 * 1000) {
    return undefined;
  }

  return closest?.[key];
}

function getCurrentValue(storage: StorageSummary, key: StorageMetricKey) {
  return Number(storage[key] ?? 0);
}

function formatMetricValue(value: number, format: StorageMetric["format"]) {
  return format === "bytes" ? formatBytes(value) : value.toLocaleString();
}

function formatMetricDelta(delta: number, format: StorageMetric["format"]) {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const absolute = Math.abs(delta);
  const value = format === "bytes" ? formatBytes(absolute) : absolute.toLocaleString();
  return `${sign}${value}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatPercentage(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";
  const digits = Math.abs(value) >= 10 ? 0 : 1;
  return `${sign}${value.toFixed(digits)}%`;
}

function formatSnapshotDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
