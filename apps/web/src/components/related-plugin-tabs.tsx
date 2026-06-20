"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PluginIcon } from "@/components/plugin-icon";
import { ScoreBadge } from "@/components/score-badge";
import { TagChips } from "@/components/tag-chips";
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

  return (
    <section className="rounded-md border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line p-5 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-base font-semibold">Related Plugins</h2>
        <div
          role="tablist"
          aria-label="Related plugins"
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

      <div role="tabpanel" className="divide-y divide-line">
        {selectedTab.plugins.map((plugin) => (
          <div
            key={plugin.slug}
            className="grid gap-3 p-4 transition hover:bg-surface-subtle sm:grid-cols-[1fr_auto]"
          >
            <div className="flex min-w-0 gap-3">
              <PluginIcon plugin={plugin} size="sm" />
              <div className="min-w-0">
                <Link
                  href={`/plugins/${encodeURIComponent(plugin.slug)}`}
                  className="block truncate font-semibold text-info hover:underline"
                >
                  {plugin.name}
                </Link>
                <p className="mt-1 truncate text-xs text-muted">
                  {plugin.activeInstalls} active installs
                </p>
                <div className="mt-2">
                  <TagChips tags={plugin.tags} limit={3} size="xs" />
                </div>
              </div>
            </div>
            <div className="flex items-center sm:justify-end">
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
