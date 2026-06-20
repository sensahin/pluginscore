import Link from "next/link";
import type { PluginTag } from "@/lib/plugin-score-data";

export function TagChips({
  tags,
  limit = 5,
  size = "sm",
}: {
  tags?: PluginTag[];
  limit?: number;
  size?: "xs" | "sm";
}) {
  const visibleTags = (tags ?? []).slice(0, limit);

  if (visibleTags.length === 0) {
    return null;
  }

  const className =
    size === "xs"
      ? "rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-muted transition hover:border-brand/30 hover:text-foreground"
      : "rounded-md border border-line bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted transition hover:border-brand/30 hover:text-foreground";

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag) => (
        <Link
          key={tag.slug}
          href={`/tags/${encodeURIComponent(tag.slug)}`}
          className={className}
        >
          {tag.name}
        </Link>
      ))}
    </div>
  );
}
