import { AlertTriangle, FileWarning } from "lucide-react";
import Link from "next/link";
import type { IssueSummary } from "@/lib/plugin-score-data";

type IssueGroup = {
  family: string;
  label: string;
  issues: IssueSummary[];
  affectedPlugins: number;
  highestWeight: IssueSummary["weight"];
};

export function IssueTaxonomyTable({
  issues,
  title = "Issue Taxonomy",
}: {
  issues: IssueSummary[];
  title?: string;
}) {
  const groups = groupIssuesByFamily(issues);
  const totalAffected = issues.reduce(
    (sum, issue) => sum + issue.affectedPlugins,
    0,
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-md border border-line bg-surface">
        <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">
              {issues.length.toLocaleString()} issue codes across{" "}
              {groups.length.toLocaleString()} categories.
            </p>
          </div>
          <FileWarning size={18} className="text-muted" aria-hidden="true" />
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group) => (
            <a
              key={group.family}
              href={`#${issueGroupId(group.family)}`}
              className="rounded-md border border-line bg-background p-4 transition hover:bg-surface-subtle"
            >
              <p className="truncate text-sm font-semibold">{group.label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold">
                {group.issues.length.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">
                {group.affectedPlugins.toLocaleString()} affected references
              </p>
            </a>
          ))}
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-muted">
          {totalAffected.toLocaleString()} affected plugin references in the current issue index.
        </div>
      </div>

      {groups.map((group) => (
        <section
          key={group.family}
          id={issueGroupId(group.family)}
          className="scroll-mt-24 overflow-hidden rounded-md border border-line bg-surface"
        >
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">{group.label}</h2>
              <p className="mt-1 text-sm text-muted">
                {group.issues.length.toLocaleString()} issue code
                {group.issues.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1">
                <AlertTriangle size={14} aria-hidden="true" />
                {group.affectedPlugins.toLocaleString()} affected
              </span>
              <span className="rounded-md border border-line px-2 py-1">
                {group.highestWeight} max weight
              </span>
            </div>
          </div>

          <div className="divide-y divide-line">
            {group.issues.map((issue) => (
              <Link
                key={issue.code}
                href={`/issues/${encodeURIComponent(issue.code)}`}
                className="grid gap-3 p-5 transition hover:bg-surface-subtle md:grid-cols-[minmax(0,1fr)_7rem_7rem]"
              >
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">{issue.title}</h3>
                  <p className="mt-1 break-all font-mono text-xs leading-5 text-muted">
                    {issue.code}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted">Weight</p>
                  <p className="mt-1 w-fit rounded-md bg-surface-subtle px-2 py-1 text-xs font-semibold">
                    {issue.weight}
                  </p>
                </div>
                <div className="md:text-right">
                  <p className="text-xs uppercase text-muted">Affected</p>
                  <p className="mt-1 font-mono font-semibold">
                    {issue.affectedPlugins.toLocaleString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function groupIssuesByFamily(issues: IssueSummary[]) {
  const groups = new Map<string, IssueSummary[]>();

  for (const issue of issues) {
    const familyIssues = groups.get(issue.family) ?? [];
    familyIssues.push(issue);
    groups.set(issue.family, familyIssues);
  }

  return [...groups.entries()]
    .map(([family, familyIssues]): IssueGroup => {
      const sortedIssues = [...familyIssues].sort(
        (a, b) =>
          b.affectedPlugins - a.affectedPlugins ||
          issueWeightRank(a.weight) - issueWeightRank(b.weight) ||
          a.title.localeCompare(b.title),
      );

      return {
        family,
        label: formatIssueFamily(family),
        issues: sortedIssues,
        affectedPlugins: sortedIssues.reduce(
          (sum, issue) => sum + issue.affectedPlugins,
          0,
        ),
        highestWeight: sortedIssues.reduce(
          (highest, issue) =>
            issueWeightRank(issue.weight) < issueWeightRank(highest)
              ? issue.weight
              : highest,
          sortedIssues[0]?.weight ?? "low",
        ),
      };
    })
    .sort(
      (a, b) =>
        b.affectedPlugins - a.affectedPlugins ||
        b.issues.length - a.issues.length ||
        a.family.localeCompare(b.family),
    );
}

function issueWeightRank(weight: IssueSummary["weight"]) {
  if (weight === "critical") return 0;
  if (weight === "high") return 1;
  if (weight === "medium") return 2;
  return 3;
}

function formatIssueFamily(family: string) {
  return family
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function issueGroupId(family: string) {
  return `issues-${family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
