"use client";

import { useMemo, useState } from "react";
import { PluginListTable } from "@/components/plugin-list-table";
import type { PluginSummary } from "@/lib/plugin-score-data";

export type PluginTabbedListTab = {
  id: string;
  label: string;
  plugins: PluginSummary[];
  emptyLabel?: string;
  showRank?: boolean;
};

export function PluginTabbedList({
  title,
  tabs,
  initialTabId,
  showRank = true,
}: {
  title: string;
  tabs: PluginTabbedListTab[];
  initialTabId?: string;
  showRank?: boolean;
}) {
  const availableTabs = useMemo(
    () => tabs.filter((tab) => tab.plugins.length > 0 || tab.emptyLabel),
    [tabs],
  );
  const [selectedId, setSelectedId] = useState(
    initialTabId ?? availableTabs[0]?.id ?? "",
  );
  const selectedTab =
    availableTabs.find((tab) => tab.id === selectedId) ?? availableTabs[0];

  if (!selectedTab) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div
          role="tablist"
          aria-label={title}
          className="flex flex-wrap gap-2"
        >
          {availableTabs.map((tab) => {
            const isSelected = tab.id === selectedTab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedId(tab.id)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-brand/40 bg-brand/10 text-foreground"
                    : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        <PluginListTable
          plugins={selectedTab.plugins}
          showRank={selectedTab.showRank ?? showRank}
          emptyLabel={selectedTab.emptyLabel}
        />
      </div>
    </section>
  );
}
