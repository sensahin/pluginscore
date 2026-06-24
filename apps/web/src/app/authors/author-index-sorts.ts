import type { AuthorIndexSort } from "@/lib/api";

export const authorIndexSorts = {
  installs_desc: { label: "Most Installed", title: "Most Installed" },
  downloads_desc: { label: "Most Downloaded", title: "Most Downloaded" },
  score_desc: { label: "Top Scores", title: "Top Scores" },
  score_asc: { label: "Needs Review", title: "Needs Review" },
  new_popular_desc: { label: "New & Popular", title: "New & Popular" },
  issues_desc: { label: "Most Issues", title: "Most Issues" },
  scanned_desc: { label: "Recently Scanned", title: "Recently Scanned" },
} as const satisfies Record<AuthorIndexSort, { label: string; title: string }>;

export const authorIndexSortKeys = Object.keys(authorIndexSorts) as AuthorIndexSort[];
