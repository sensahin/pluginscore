import type { ComparisonPluginSummary } from "@pluginscore/core";
import { ComparisonLink } from "@/components/comparison-link";
import { ComparisonLinksGrid } from "@/components/comparison-links-grid";

export function FeaturedComparisons({
  comparisons,
}: {
  comparisons: ComparisonPluginSummary[][];
}) {
  if (comparisons.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Featured Comparisons</h2>
      <ComparisonLinksGrid>
        {comparisons.map((plugins) => (
          <ComparisonLink
            key={plugins.map((plugin) => plugin.slug).join(":")}
            plugins={plugins}
          />
        ))}
      </ComparisonLinksGrid>
    </section>
  );
}
