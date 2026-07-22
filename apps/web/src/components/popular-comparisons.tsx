import type { ComparisonSummary } from "@pluginscore/core";
import { ComparisonLink } from "@/components/comparison-link";
import { ComparisonLinksGrid } from "@/components/comparison-links-grid";

export function PopularComparisons({
  comparisons,
}: {
  comparisons: ComparisonSummary[];
}) {
  if (comparisons.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Popular Comparisons</h2>
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
