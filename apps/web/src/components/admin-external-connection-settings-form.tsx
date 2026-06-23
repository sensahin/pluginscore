"use client";

import { useState } from "react";
import type { ExternalConnectionAnalysisMode } from "@pluginscore/core";

type AdminExternalConnectionSettingsFormProps = {
  mode: ExternalConnectionAnalysisMode;
  sampleRemaining: number;
};

export function AdminExternalConnectionSettingsForm({
  mode: initialMode,
  sampleRemaining,
}: AdminExternalConnectionSettingsFormProps) {
  const [mode, setMode] = useState<ExternalConnectionAnalysisMode>(initialMode);
  const [sampleValue, setSampleValue] = useState(
    String(initialMode === "sample" ? sampleRemaining : 25),
  );
  const isSampleMode = mode === "sample";

  return (
    <form
      action="/admin/external-connections"
      method="post"
      className={`grid gap-3 ${
        isSampleMode
          ? "sm:grid-cols-[minmax(0,12rem)_8rem_auto]"
          : "sm:grid-cols-[minmax(0,12rem)_auto]"
      }`}
    >
      <label className="grid gap-1 text-xs font-medium uppercase text-muted">
        Mode
        <select
          name="mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as ExternalConnectionAnalysisMode)}
          className="h-10 rounded-md border border-line bg-background px-3 text-sm normal-case text-foreground"
        >
          <option value="off">Off</option>
          <option value="new_scans">New scans</option>
          <option value="sample">Sample</option>
        </select>
      </label>

      {isSampleMode ? (
        <label className="grid gap-1 text-xs font-medium uppercase text-muted">
          Sample
          <input
            name="sampleRemaining"
            type="number"
            min="0"
            max="1000"
            value={sampleValue}
            onChange={(event) => setSampleValue(event.target.value)}
            className="h-10 rounded-md border border-line bg-background px-3 text-sm normal-case text-foreground"
          />
        </label>
      ) : null}

      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center self-end rounded-md border border-line px-3 text-sm font-semibold transition hover:bg-surface-subtle"
      >
        Save
      </button>
    </form>
  );
}
