"use client";

import { Trash2 } from "lucide-react";

export function AdminRawReportRetentionForm({
  eligibleReports,
  batchSize,
}: {
  eligibleReports: number;
  batchSize: number;
}) {
  const disabled = eligibleReports === 0;
  const cleanupCount = Math.min(eligibleReports, batchSize);

  return (
    <form
      action="/admin/raw-report-retention"
      method="post"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Remove raw JSON from ${cleanupCount.toLocaleString()} eligible historical audits?`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={16} aria-hidden="true" />
        {disabled ? "Nothing to clean" : "Run cleanup"}
      </button>
    </form>
  );
}
