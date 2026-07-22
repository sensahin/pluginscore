"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ComparisonLink } from "@/components/comparison-link";
import { ComparisonLinksGrid } from "@/components/comparison-links-grid";
import {
  parseRecentComparisons,
  RECENT_COMPARISONS_STORAGE_KEY,
} from "@/lib/recent-comparisons";

export function RecentComparisons() {
  const snapshot = useSyncExternalStore(
    subscribeToStorage,
    readStorageSnapshot,
    emptyStorageSnapshot,
  );
  const comparisons = useMemo(
    () => parseRecentComparisons(snapshot),
    [snapshot],
  );

  if (comparisons.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Your Recent Comparisons</h2>
      <ComparisonLinksGrid>
        {comparisons.map((comparison) => (
          <ComparisonLink
            key={JSON.stringify(comparison.pluginSlugs)}
            plugins={comparison.plugins}
          />
        ))}
      </ComparisonLinksGrid>
    </section>
  );
}

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readStorageSnapshot() {
  return window.localStorage.getItem(RECENT_COMPARISONS_STORAGE_KEY) ?? "";
}

function emptyStorageSnapshot() {
  return "";
}
