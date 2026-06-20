import { FileWarning } from "lucide-react";
import Link from "next/link";
import type { IssueSummary } from "@/lib/plugin-score-data";

export function IssueTaxonomyTable({
  issues,
  title = "Issue Taxonomy",
}: {
  issues: IssueSummary[];
  title?: string;
}) {
  return (
    <section className="min-w-0 rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <FileWarning size={18} className="text-muted" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase text-muted">
              <th className="px-5 py-3 font-semibold">Issue</th>
              <th className="px-5 py-3 font-semibold">Family</th>
              <th className="px-5 py-3 font-semibold">Weight</th>
              <th className="px-5 py-3 text-right font-semibold">Affected</th>
              <th className="px-5 py-3 font-semibold">Fix</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.code} className="border-b border-line last:border-b-0">
                <td className="px-5 py-4">
                  <Link
                    href={`/issues/${encodeURIComponent(issue.code)}`}
                    className="font-medium text-foreground hover:text-brand"
                  >
                    {issue.title}
                  </Link>
                  <div className="mt-1 break-all font-mono text-xs leading-5 text-muted">
                    {issue.code}
                  </div>
                </td>
                <td className="px-5 py-4">{issue.family}</td>
                <td className="px-5 py-4">
                  <span className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-semibold">
                    {issue.weight}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-mono">
                  {issue.affectedPlugins}
                </td>
                <td className="max-w-sm px-5 py-4 text-muted">{issue.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
