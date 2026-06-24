import type {
  ExternalConnectionAnalysisSummary,
  ExternalConnectionConfidence,
  ExternalConnectionEndpointSummary,
  ExternalConnectionFinding,
  ExternalConnectionType,
} from "@pluginscore/core";
import { isExternalDomainLikelyPublicHostname } from "@pluginscore/core";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

export const EXTERNAL_CONNECTION_ANALYSIS_VERSION = "2026.06-static-v1";

type AnalysisOptions = {
  timeoutMs: number;
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxFindings?: number;
};

type ScanContext = Required<AnalysisOptions> & {
  startedAt: number;
  deadline: number;
  pluginDir: string;
  filesScanned: number;
  bytesScanned: number;
  findings: ExternalConnectionFinding[];
  seen: Set<string>;
};

const defaultOptions: Required<AnalysisOptions> = {
  timeoutMs: 15_000,
  maxFiles: 2_000,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxFindings: 300,
};

const scannedExtensions = new Set([
  ".php",
  ".inc",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".htm",
]);

const skippedDirectories = new Set([
  ".git",
  ".svn",
  "node_modules",
  "bower_components",
  "cache",
  "tmp",
  "vendor-bin",
]);

const ignoredDomains = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
  "::1",
]);

export async function analyzeExternalConnections(
  pluginDir: string,
  pluginVersion: string,
  options: AnalysisOptions,
): Promise<ExternalConnectionAnalysisSummary> {
  const startedAt = Date.now();
  const resolvedOptions = { ...defaultOptions, ...options };
  const context: ScanContext = {
    ...resolvedOptions,
    startedAt,
    deadline: startedAt + resolvedOptions.timeoutMs,
    pluginDir,
    filesScanned: 0,
    bytesScanned: 0,
    findings: [],
    seen: new Set(),
  };

  await scanDirectory(pluginDir, context);

  return summarizeAnalysis(pluginVersion, context, Date.now() - startedAt);
}

export function externalConnectionFailureSummary(
  pluginVersion: string,
  error: unknown,
  durationMs: number,
): ExternalConnectionAnalysisSummary {
  return {
    status: "failed",
    analysisVersion: EXTERNAL_CONNECTION_ANALYSIS_VERSION,
    pluginVersion,
    analyzedAt: new Date().toISOString(),
    durationMs,
    errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Connection analysis failed.",
    filesScanned: 0,
    bytesScanned: 0,
    totals: emptyTotals(),
    domains: [],
    endpoints: [],
    findings: [],
  };
}

async function scanDirectory(dir: string, context: ScanContext) {
  assertWithinDeadline(context);

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    assertWithinDeadline(context);

    if (context.filesScanned >= context.maxFiles || context.bytesScanned >= context.maxTotalBytes) {
      return;
    }

    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        await scanDirectory(path, context);
      }
      continue;
    }

    if (!entry.isFile() || !scannedExtensions.has(extname(entry.name).toLowerCase())) {
      continue;
    }

    const stats = await stat(path);
    if (stats.size > context.maxFileBytes) {
      continue;
    }

    if (context.bytesScanned + stats.size > context.maxTotalBytes) {
      return;
    }

    const content = await readFile(path, "utf8");
    context.filesScanned += 1;
    context.bytesScanned += Buffer.byteLength(content);
    scanContent(content, safeRelativePath(context.pluginDir, path), context);
  }
}

function scanContent(content: string, filePath: string, context: ScanContext) {
  const lineIndex = buildLineIndex(content);

  scanKnownUrlCalls(content, filePath, lineIndex, context);
  scanIncomingEndpoints(content, filePath, lineIndex, context);
  scanUrlLiterals(content, filePath, lineIndex, context);
}

function scanKnownUrlCalls(
  content: string,
  filePath: string,
  lineIndex: number[],
  context: ScanContext,
) {
  const patterns: Array<{
    regex: RegExp;
    type: ExternalConnectionType;
    confidence: ExternalConnectionConfidence;
    sourceFromMatch?: number;
    urlFromMatch: number;
    source: string;
  }> = [
    {
      regex: /\b(wp_remote_get|wp_remote_post|wp_remote_request|wp_safe_remote_get|wp_safe_remote_post|wp_remote_head|download_url)\s*\(\s*(['"])(https?:\/\/[^'"\s<>)]+)\2/g,
      type: "outbound_http",
      confidence: "high",
      sourceFromMatch: 1,
      urlFromMatch: 3,
      source: "wordpress_http_api",
    },
    {
      regex: /\b(file_get_contents|fopen)\s*\(\s*(['"])(https?:\/\/[^'"\s<>)]+)\2/g,
      type: "outbound_http",
      confidence: "high",
      sourceFromMatch: 1,
      urlFromMatch: 3,
      source: "php_stream",
    },
    {
      regex: /\bcurl_setopt\s*\([\s\S]{0,240}CURLOPT_URL[\s\S]{0,120}(['"])(https?:\/\/[^'"\s<>)]+)\1/g,
      type: "outbound_http",
      confidence: "high",
      urlFromMatch: 2,
      source: "curl_setopt",
    },
    {
      regex: /\bcurl_init\s*\(\s*(['"])(https?:\/\/[^'"\s<>)]+)\1/g,
      type: "outbound_http",
      confidence: "high",
      urlFromMatch: 2,
      source: "curl_init",
    },
    {
      regex: /\bwp_enqueue_(script|style)\s*\([\s\S]{0,500}?(['"])(https?:\/\/[^'"\s<>)]+)\2/g,
      type: "external_asset",
      confidence: "medium",
      sourceFromMatch: 1,
      urlFromMatch: 3,
      source: "wp_enqueue",
    },
    {
      regex: /<(script|link|img|iframe)\b[^>]+(?:src|href)=['"](https?:\/\/[^'"]+)['"]/gi,
      type: "external_asset",
      confidence: "medium",
      sourceFromMatch: 1,
      urlFromMatch: 2,
      source: "html_asset",
    },
    {
      regex: /\burl\(\s*(['"]?)(https?:\/\/[^'")]+)\1\s*\)/gi,
      type: "external_asset",
      confidence: "medium",
      urlFromMatch: 2,
      source: "css_url",
    },
    {
      regex: /\b(fetch|axios\.(?:get|post|request)|jQuery\.ajax|\$\.ajax)\s*\(\s*(['"])(https?:\/\/[^'"\s<>)]+)\2/g,
      type: "outbound_http",
      confidence: "high",
      sourceFromMatch: 1,
      urlFromMatch: 3,
      source: "javascript_http",
    },
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern.regex)) {
      const rawUrl = match[pattern.urlFromMatch];
      const normalized = normalizeUrl(rawUrl);
      if (!normalized) {
        continue;
      }

      addFinding(context, {
        type: pattern.type,
        confidence: pattern.confidence,
        source: pattern.sourceFromMatch ? match[pattern.sourceFromMatch] ?? pattern.source : pattern.source,
        filePath,
        line: lineForIndex(lineIndex, match.index ?? 0),
        url: normalized.url,
        domain: normalized.domain,
      });
    }
  }
}

function scanIncomingEndpoints(
  content: string,
  filePath: string,
  lineIndex: number[],
  context: ScanContext,
) {
  for (const match of content.matchAll(/\bregister_rest_route\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]+)\3/g)) {
    const namespace = match[2].replace(/^\/+|\/+$/g, "");
    const route = match[4].startsWith("/") ? match[4] : `/${match[4]}`;

    addFinding(context, {
      type: "incoming_endpoint",
      confidence: "high",
      source: "register_rest_route",
      filePath,
      line: lineForIndex(lineIndex, match.index ?? 0),
      endpoint: `/wp-json/${namespace}${route}`,
      method: "REST",
    });
  }

  for (const match of content.matchAll(/\badd_action\s*\(\s*(['"])(wp_ajax(?:_nopriv)?_[^'"]+|admin_post(?:_nopriv)?_[^'"]+)\1/g)) {
    const hook = match[2];
    const isPublic = hook.includes("_nopriv_");

    addFinding(context, {
      type: "incoming_endpoint",
      confidence: "high",
      source: hook.startsWith("admin_post") ? "admin_post" : "wp_ajax",
      filePath,
      line: lineForIndex(lineIndex, match.index ?? 0),
      endpoint: hook,
      method: isPublic ? "public action" : "authenticated action",
    });
  }
}

function scanUrlLiterals(
  content: string,
  filePath: string,
  lineIndex: number[],
  context: ScanContext,
) {
  for (const match of content.matchAll(/\bhttps?:\/\/[^\s"'<>`)\\]+/gi)) {
    const normalized = normalizeUrl(match[0]);
    if (!normalized) {
      continue;
    }
    const line = lineForIndex(lineIndex, match.index ?? 0);

    if (
      context.findings.some((finding) =>
        finding.url === normalized.url &&
        finding.filePath === filePath &&
        finding.line === line
      )
    ) {
      continue;
    }

    addFinding(context, {
      type: "outbound_http",
      confidence: "low",
      source: "url_literal",
      filePath,
      line,
      url: normalized.url,
      domain: normalized.domain,
    });
  }
}

function addFinding(context: ScanContext, finding: ExternalConnectionFinding) {
  if (context.findings.length >= context.maxFindings) {
    return;
  }

  const key = [
    finding.type,
    finding.source,
    finding.url ?? "",
    finding.endpoint ?? "",
    finding.filePath ?? "",
    finding.line ?? "",
  ].join("|");

  if (context.seen.has(key)) {
    return;
  }

  context.seen.add(key);
  context.findings.push(finding);
}

function summarizeAnalysis(
  pluginVersion: string,
  context: ScanContext,
  durationMs: number,
): ExternalConnectionAnalysisSummary {
  const domains = summarizeDomains(context.findings);
  const endpoints = summarizeEndpoints(context.findings);
  const totals = {
    ...emptyTotals(),
    domains: domains.length,
    outboundCalls: context.findings.filter((finding) => finding.type === "outbound_http").length,
    externalAssets: context.findings.filter((finding) => finding.type === "external_asset").length,
    incomingEndpoints: endpoints.reduce((sum, endpoint) => sum + endpoint.count, 0),
    findings: context.findings.length,
    highConfidence: context.findings.filter((finding) => finding.confidence === "high").length,
    mediumConfidence: context.findings.filter((finding) => finding.confidence === "medium").length,
    lowConfidence: context.findings.filter((finding) => finding.confidence === "low").length,
  };

  return {
    status: "complete",
    analysisVersion: EXTERNAL_CONNECTION_ANALYSIS_VERSION,
    pluginVersion,
    analyzedAt: new Date().toISOString(),
    durationMs,
    filesScanned: context.filesScanned,
    bytesScanned: context.bytesScanned,
    totals,
    domains,
    endpoints,
    findings: context.findings,
  };
}

function summarizeDomains(findings: ExternalConnectionFinding[]) {
  const byDomain = new Map<string, {
    types: Set<ExternalConnectionType>;
    confidence: ExternalConnectionConfidence;
    count: number;
    sampleUrls: string[];
  }>();

  for (const finding of findings) {
    if (!finding.domain || !finding.url) {
      continue;
    }

    const existing = byDomain.get(finding.domain) ?? {
      types: new Set<ExternalConnectionType>(),
      confidence: finding.confidence,
      count: 0,
      sampleUrls: [],
    };
    existing.types.add(finding.type);
    existing.confidence = strongestConfidence(existing.confidence, finding.confidence);
    existing.count += 1;
    if (!existing.sampleUrls.includes(finding.url) && existing.sampleUrls.length < 5) {
      existing.sampleUrls.push(finding.url);
    }
    byDomain.set(finding.domain, existing);
  }

  return [...byDomain.entries()]
    .map(([domain, summary]) => ({
      domain,
      types: [...summary.types].sort(),
      confidence: summary.confidence,
      count: summary.count,
      sampleUrls: summary.sampleUrls,
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain))
    .slice(0, 100);
}

function summarizeEndpoints(findings: ExternalConnectionFinding[]): ExternalConnectionEndpointSummary[] {
  const byEndpoint = new Map<string, {
    source: string;
    exposure: ExternalConnectionEndpointSummary["exposure"];
    count: number;
    sampleFiles: string[];
  }>();

  for (const finding of findings) {
    if (finding.type !== "incoming_endpoint" || !finding.endpoint) {
      continue;
    }

    const existing = byEndpoint.get(finding.endpoint) ?? {
      source: finding.source,
      exposure: endpointExposure(finding),
      count: 0,
      sampleFiles: [],
    };
    existing.count += 1;
    if (finding.filePath && !existing.sampleFiles.includes(finding.filePath) && existing.sampleFiles.length < 5) {
      existing.sampleFiles.push(finding.filePath);
    }
    byEndpoint.set(finding.endpoint, existing);
  }

  return [...byEndpoint.entries()]
    .map(([endpoint, summary]) => ({ endpoint, ...summary }))
    .sort((a, b) => b.count - a.count || a.endpoint.localeCompare(b.endpoint))
    .slice(0, 100);
}

function endpointExposure(finding: ExternalConnectionFinding): ExternalConnectionEndpointSummary["exposure"] {
  if (finding.endpoint?.includes("_nopriv_") || finding.method === "public action") {
    return "public";
  }

  if (finding.source === "wp_ajax" || finding.source === "admin_post") {
    return "authenticated";
  }

  return "unknown";
}

function normalizeUrl(rawValue: string | undefined) {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue
    .replaceAll("&amp;", "&")
    .replace(/[),.;\]]+$/g, "");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!domain || ignoredDomains.has(domain) || !isExternalDomainLikelyPublicHostname(domain)) {
      return null;
    }

    return {
      url: parsed.toString(),
      domain,
    };
  } catch {
    return null;
  }
}

function strongestConfidence(
  current: ExternalConnectionConfidence,
  next: ExternalConnectionConfidence,
): ExternalConnectionConfidence {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[next] > rank[current] ? next : current;
}

function buildLineIndex(content: string) {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lineForIndex(lineIndex: number[], index: number) {
  let low = 0;
  let high = lineIndex.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineIndex[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(1, high + 1);
}

function safeRelativePath(root: string, path: string) {
  return relative(root, path).split(sep).join("/");
}

function assertWithinDeadline(context: ScanContext) {
  if (Date.now() > context.deadline) {
    throw new Error("External connection analysis timed out.");
  }
}

function emptyTotals() {
  return {
    domains: 0,
    outboundCalls: 0,
    externalAssets: 0,
    incomingEndpoints: 0,
    findings: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
  };
}
