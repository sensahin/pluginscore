import type { FindingCodeCount } from "@pluginscore/core";

export function groupFindingCodeCounts(findings: FindingCodeCount[]) {
  const groups = new Map<
    string,
    { family: string; total: number; findings: FindingCodeCount[] }
  >();

  for (const finding of findings) {
    const existing =
      groups.get(finding.family) ??
      { family: finding.family, total: 0, findings: [] };
    existing.total += finding.count;
    existing.findings.push(finding);
    groups.set(finding.family, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      findings: [...group.findings].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total);
}
