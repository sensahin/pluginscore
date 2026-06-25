import type { NormalizedFinding, ScanJobDto } from "@pluginscore/core";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { ScannerConfig } from "./config.js";
import type { ScanPaths } from "./files.js";

export class ScanCommandError extends Error {
  constructor(
    message: string,
    readonly options: {
      timedOut?: boolean;
      stderr?: string;
      durationMs?: number;
      exitCode?: number;
    } = {},
  ) {
    super(message);
  }
}

export type PluginCheckResult = {
  findings: NormalizedFinding[];
  rawReport: unknown;
  stderr: string;
  stdout: string;
  exitCode: number;
  durationMs: number;
};

export async function runPluginCheck(
  job: ScanJobDto,
  paths: ScanPaths,
  config: ScannerConfig,
): Promise<PluginCheckResult> {
  if (!config.pluginCheckCommand) {
    throw new ScanCommandError(
      "PLUGIN_CHECK_COMMAND is not configured. Set it to the pinned Plugin Check WP-CLI command before running real scans.",
    );
  }

  const command = renderCommand(config.pluginCheckCommand, {
    pluginDir: paths.pluginDir,
    jsonPath: paths.jsonPath,
    slug: job.slug,
    tmpDir: paths.jobDir,
  });
  const startedAt = Date.now();
  const output = await runShell(command, config.scanTimeoutMs);
  const durationMs = Date.now() - startedAt;
  const reportText = await readReportText(paths.jsonPath, output.stdout);
  const rawReport = parsePluginCheckReport(reportText);
  const findings = normalizePluginCheckReport(rawReport);

  return {
    findings,
    rawReport,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exitCode,
    durationMs,
  };
}

export function normalizePluginCheckOutput(text: string): NormalizedFinding[] {
  return normalizePluginCheckReport(parsePluginCheckReport(text));
}

export function parsePluginCheckReport(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed || /^success[:\s]/i.test(trimmed) || /no issues found/i.test(trimmed)) {
    return [];
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const sectionedReport = parsePluginCheckFileSections(trimmed);
    if (sectionedReport) {
      return sectionedReport;
    }

    throw new ScanCommandError(`Plugin Check did not return parseable JSON: ${(error as Error).message}`);
  }
}

function parsePluginCheckFileSections(text: string): unknown[] | null {
  const findings: unknown[] = [];
  const lines = text.split(/\r?\n/);
  let currentFile: string | undefined;
  let currentJsonLines: string[] = [];
  let sawFileSection = false;

  const flushSection = () => {
    if (!currentFile) {
      currentJsonLines = [];
      return;
    }

    const sectionText = currentJsonLines.join("\n").trim();
    currentJsonLines = [];

    if (!sectionText) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(sectionText);
    } catch (error) {
      throw new ScanCommandError(
        `Plugin Check FILE section for ${currentFile} was not parseable JSON: ${(error as Error).message}`,
      );
    }

    for (const finding of extractSectionFindings(parsed)) {
      findings.push(attachFilePathToFinding(finding, currentFile));
    }
  };

  for (const line of lines) {
    const fileMatch = line.match(/^FILE:\s*(.+?)\s*$/);

    if (fileMatch) {
      flushSection();
      currentFile = fileMatch[1];
      sawFileSection = true;
      continue;
    }

    if (currentFile) {
      currentJsonLines.push(line);
    }
  }

  flushSection();

  return sawFileSection ? findings : null;
}

function extractSectionFindings(parsed: unknown): unknown[] {
  const findings = extractRawFindings(parsed);

  if (findings.length > 0) {
    return findings;
  }

  if (
    isObject(parsed) &&
    readString(parsed, ["code", "sniff_code", "rule", "check", "id"]) &&
    readString(parsed, ["message", "description", "text"])
  ) {
    return [parsed];
  }

  return [];
}

function attachFilePathToFinding(raw: unknown, filePath: string): unknown {
  if (!isObject(raw)) {
    return raw;
  }

  return {
    ...raw,
    file: readString(raw, ["file", "file_path", "path"]) ?? filePath,
  };
}

function normalizePluginCheckReport(report: unknown): NormalizedFinding[] {
  const rawFindings = extractRawFindings(report);
  return rawFindings.map(normalizeFinding).filter((finding): finding is NormalizedFinding => Boolean(finding));
}

function extractRawFindings(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isObject(parsed)) {
    for (const key of ["findings", "results", "messages", "issues"]) {
      const value = parsed[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function normalizeFinding(raw: unknown): NormalizedFinding | null {
  if (!isObject(raw)) {
    return null;
  }

  const code = readString(raw, ["code", "sniff_code", "rule", "check", "id"]);
  const message = readString(raw, ["message", "description", "text"]);

  if (!code || !message) {
    return null;
  }

  const severityToken = readString(raw, ["type", "severity", "level"])?.toLowerCase() ?? "warning";
  const severity = severityToken.includes("error") ? "error" : "warning";

  return {
    code,
    type: readString(raw, ["type", "category"]) ?? severity,
    severity,
    filePath: readString(raw, ["file", "file_path", "path"]),
    line: readNumber(raw, ["line", "line_number"]),
    column: readNumber(raw, ["column", "column_number"]),
    message,
    docsUrl: readString(raw, ["docs", "docs_url", "documentation", "link"]),
  };
}

function renderCommand(command: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, shellEscape(value)),
    command,
  );
}

function runShell(command: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
    const child = spawn("/bin/sh", ["-lc", command], {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child.pid);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
      };

      if (timedOut) {
        reject(
          new ScanCommandError("Plugin Check command timed out", {
            timedOut: true,
            stderr: output.stderr,
            durationMs: timeoutMs,
            exitCode: output.exitCode,
          }),
        );
        return;
      }

      resolve(output);
    });
  });
}

function killProcessGroup(pid: number | undefined) {
  if (!pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      process.kill(pid, "SIGKILL");
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH") {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // The close handler reports the timeout even if the process already exited.
      }
    }
  }
}

async function readReportText(jsonPath: string, stdout: string) {
  try {
    const file = await readFile(jsonPath, "utf8");
    if (file.trim()) {
      return file;
    }
  } catch {
    // Many command templates emit JSON to stdout instead of a file.
  }

  return stdout;
}

function shellEscape(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function readNumber(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}
