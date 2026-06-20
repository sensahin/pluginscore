export type FindingSeverity = "error" | "warning";

export type FindingFamily =
  | "security"
  | "supply_chain"
  | "repo_compliance"
  | "direct_file_access"
  | "performance"
  | "maintainability"
  | "i18n";

export type FindingCodeSummary = {
  code: string;
  family: FindingFamily;
  severity: FindingSeverity;
  count: number;
};

export type ComputedScoreBreakdown = {
  score: number;
  securityScore: number;
  repoScore: number;
  performanceScore: number;
  maintainabilityScore: number;
};

export const SCORING_MODEL_VERSION = "2026.06-mvp-static-v2";

export const familyWeights: Record<FindingFamily, number> = {
  security: 8,
  supply_chain: 7,
  repo_compliance: 4,
  direct_file_access: 4,
  performance: 3,
  maintainability: 1.5,
  i18n: 0.35,
};

export const severityWeights: Record<FindingSeverity, number> = {
  error: 1.4,
  warning: 0.75,
};

export const overallScoreWeights = {
  security: 0.55,
  repo: 0.15,
  performance: 0.1,
  maintainability: 0.2,
};

export const minimumNonCriticalScore = 5;
export const minimumCriticalCappedScore = 1;

export function scoreFindings(findings: FindingCodeSummary[]) {
  const penalty = findings.reduce((total, finding) => {
    const familyWeight = familyWeights[finding.family];
    const severityWeight = severityWeights[finding.severity];
    const repeatPenalty = Math.sqrt(Math.max(0, finding.count));

    return total + familyWeight * severityWeight * repeatPenalty;
  }, 0);

  return Math.max(0, Math.round(100 - Math.min(100, penalty)));
}

export function scoreAuditSummary(findings: FindingCodeSummary[]): ComputedScoreBreakdown {
  const securityScore = scoreFindings(findings.filter((item) => item.family === "security"));
  const repoScore = scoreFindings(
    findings.filter((item) =>
      ["repo_compliance", "direct_file_access", "supply_chain"].includes(item.family),
    ),
  );
  const performanceScore = scoreFindings(findings.filter((item) => item.family === "performance"));
  const maintainabilityScore = scoreFindings(
    findings.filter((item) => ["maintainability", "i18n"].includes(item.family)),
  );

  const blendedScore = Math.round(
    securityScore * overallScoreWeights.security +
      repoScore * overallScoreWeights.repo +
      performanceScore * overallScoreWeights.performance +
      maintainabilityScore * overallScoreWeights.maintainability,
  );

  return {
    score: applyCriticalSignalCaps(blendedScore, findings),
    securityScore,
    repoScore,
    performanceScore,
    maintainabilityScore,
  };
}

export function classifyScore(score: number) {
  if (score >= 90) {
    return "excellent";
  }

  if (score >= 80) {
    return "good";
  }

  if (score >= 65) {
    return "watch";
  }

  return "risk";
}

export function inferFindingFamily(code: string): FindingFamily {
  const normalized = code.toLowerCase();

  if (
    normalized.includes("security") ||
    normalized.includes("nonce") ||
    normalized.includes("escape") ||
    normalized.includes("sanitiz") ||
    normalized.includes("preparedsql")
  ) {
    return "security";
  }

  if (
    normalized.includes("hidden") ||
    normalized.includes("compressed") ||
    normalized.includes("obfuscat") ||
    normalized.includes("supply")
  ) {
    return "supply_chain";
  }

  if (normalized.includes("directfileaccess")) {
    return "direct_file_access";
  }

  if (
    normalized.includes("pluginrepo") ||
    normalized.includes("readme") ||
    normalized.includes("license") ||
    normalized.includes("header")
  ) {
    return "repo_compliance";
  }

  if (normalized.includes("performance")) {
    return "performance";
  }

  if (normalized.includes("i18n") || normalized.includes("textdomain")) {
    return "i18n";
  }

  return "maintainability";
}

function applyCriticalSignalCaps(score: number, findings: FindingCodeSummary[]) {
  const criticalSignals = findings
    .filter((finding) => finding.severity === "error" && isCriticalSignal(finding))
    .reduce((total, finding) => total + finding.count, 0);

  if (criticalSignals >= 3) {
    return 0;
  }

  if (criticalSignals > 0) {
    return Math.min(Math.max(score, minimumCriticalCappedScore), 15);
  }

  const suspiciousSupplySignals = findings
    .filter((finding) => isSupplyChainSignal(finding))
    .reduce((total, finding) => total + finding.count, 0);

  if (suspiciousSupplySignals > 0) {
    return Math.min(applyNonCriticalFloor(score), 35);
  }

  return applyNonCriticalFloor(score);
}

function applyNonCriticalFloor(score: number) {
  if (score <= 0) {
    return minimumNonCriticalScore;
  }

  return score;
}

function isCriticalSignal(finding: FindingCodeSummary) {
  return isCriticalSupplyChainSignal(finding.code) || isExploitClassSignal(finding.code);
}

function isSupplyChainSignal(finding: FindingCodeSummary) {
  return finding.family === "supply_chain" || codeHasAnyToken(finding.code, [
    "backdoor",
    "base64_decode",
    "compressed",
    "hidden",
    "malware",
    "obfuscat",
    "supply",
  ]);
}

function isCriticalSupplyChainSignal(code: string) {
  return codeHasAnyToken(code, [
    "backdoor",
    "base64_decode",
    "malware",
    "obfuscat",
  ]);
}

function isExploitClassSignal(code: string) {
  return (
    codeHasAnyToken(code, [
      "arbitrary_file",
      "deserial",
      "remote_code",
      "remote_file",
      "unserialize",
    ]) || codeHasDelimitedToken(code, ["eval", "rce", "shell"])
  );
}

function codeHasAnyToken(code: string, tokens: string[]) {
  const normalized = code.toLowerCase();

  return tokens.some((token) => normalized.includes(token));
}

function codeHasDelimitedToken(code: string, tokens: string[]) {
  const normalized = code.toLowerCase();

  return tokens.some((token) => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenPattern = new RegExp(`(^|[^a-z0-9])${escapedToken}($|[^a-z0-9])`);

    return tokenPattern.test(normalized);
  });
}

export function summarizeFindings(
  findings: Array<{ code: string; severity: FindingSeverity }>,
) {
  const grouped = new Map<string, FindingCodeSummary>();

  for (const finding of findings) {
    const key = `${finding.code}:${finding.severity}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      code: finding.code,
      family: inferFindingFamily(finding.code),
      severity: finding.severity,
      count: 1,
    });
  }

  return [...grouped.values()];
}
