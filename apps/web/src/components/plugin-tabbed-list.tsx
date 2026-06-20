"use client";

import type { KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";
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
  const baseId = useId();
  const headingId = `${baseId}-heading`;
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

  function tabId(tabIdValue: string) {
    return `${baseId}-tab-${tabIdValue}`;
  }

  function panelId(tabIdValue: string) {
    return `${baseId}-panel-${tabIdValue}`;
  }

  function activateTab(index: number, tabElement?: HTMLButtonElement | null) {
    const tab = availableTabs[index];

    if (!tab) {
      return;
    }

    setSelectedId(tab.id);
    tabElement?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const tabsInDom = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ) ?? [],
    );
    const lastIndex = availableTabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    activateTab(nextIndex, tabsInDom[nextIndex]);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={headingId} className="text-xl font-semibold">{title}</h2>
        <div
          role="tablist"
          aria-labelledby={headingId}
          className="flex flex-wrap gap-2"
        >
          {availableTabs.map((tab, index) => {
            const isSelected = tab.id === selectedTab.id;

            return (
              <button
                key={tab.id}
                id={tabId(tab.id)}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={panelId(tab.id)}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedId(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
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

      <div
        id={panelId(selectedTab.id)}
        role="tabpanel"
        aria-labelledby={tabId(selectedTab.id)}
        tabIndex={0}
        key={selectedTab.id}
      >
        <PluginListTable
          plugins={selectedTab.plugins}
          showRank={selectedTab.showRank ?? showRank}
          emptyLabel={selectedTab.emptyLabel}
        />
      </div>
    </section>
  );
}
