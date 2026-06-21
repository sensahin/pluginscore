"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useId, useMemo, useState } from "react";
import { PluginIcon } from "@/components/plugin-icon";
import { ScoreBadge } from "@/components/score-badge";
import type { PluginSummary } from "@/lib/plugin-score-data";

export type RelatedPluginTab = {
  id: string;
  label: string;
  plugins: PluginSummary[];
};

export function RelatedPluginTabs({
  tabs,
}: {
  tabs: RelatedPluginTab[];
}) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const availableTabs = useMemo(
    () => tabs.filter((tab) => tab.plugins.length > 0),
    [tabs],
  );
  const [selectedId, setSelectedId] = useState(availableTabs[0]?.id ?? "");
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
    <section className="rounded-md border border-line bg-surface shadow-sm">
      <div className="space-y-3 border-b border-line p-5">
        <h2 id={headingId} className="text-base font-semibold">Related Plugins</h2>
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
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
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
        className="divide-y divide-line"
      >
        {selectedTab.plugins.map((plugin) => (
          <div
            key={plugin.slug}
            className="flex items-start justify-between gap-3 p-4 transition hover:bg-surface-subtle"
          >
            <div className="flex min-w-0 gap-3">
              <PluginIcon plugin={plugin} size="sm" />
              <div className="min-w-0">
                <Link
                  href={`/plugins/${encodeURIComponent(plugin.slug)}`}
                  prefetch={false}
                  className="block truncate font-semibold text-info hover:underline"
                >
                  {plugin.name}
                </Link>
                <p className="mt-1 truncate text-xs text-muted">
                  {plugin.activeInstalls} active installs
                </p>
              </div>
            </div>
            <div className="shrink-0">
              {plugin.audited === false ? (
                <span className="inline-flex rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-semibold text-muted">
                  Pending
                </span>
              ) : (
                <ScoreBadge score={plugin.score} band={plugin.band} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
