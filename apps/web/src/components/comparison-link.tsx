import Link from "next/link";
import { PluginIcon } from "@/components/plugin-icon";
import { canonicalComparePath } from "@/lib/compare";

type ComparisonLinkPlugin = {
  slug: string;
  name: string;
  iconUrl?: string;
};

export function ComparisonLink({ plugins }: { plugins: ComparisonLinkPlugin[] }) {
  const title = plugins.map((plugin) => plugin.name).join(" vs ");

  return (
    <Link
      href={canonicalComparePath(plugins.map((plugin) => plugin.slug))}
      prefetch={false}
      className="group flex min-h-16 min-w-0 items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 transition hover:bg-surface-subtle"
      title={title}
    >
      <span className="flex shrink-0 -space-x-1.5">
        {plugins.map((plugin) => (
          <PluginIcon key={plugin.slug} plugin={plugin} size="xs" />
        ))}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold group-hover:text-info">
        {title}
      </span>
    </Link>
  );
}
