"use client";

import { useEffect } from "react";
import {
  saveRecentComparison,
  type RecentComparisonPlugin,
} from "@/lib/recent-comparisons";

export function RememberComparison({
  plugins,
}: {
  plugins: RecentComparisonPlugin[];
}) {
  useEffect(() => {
    saveRecentComparison(window.localStorage, plugins);
  }, [plugins]);

  return null;
}
