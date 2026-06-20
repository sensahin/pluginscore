import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ScanPaths = {
  jobDir: string;
  zipPath: string;
  extractDir: string;
  pluginDir: string;
  jsonPath: string;
};

export async function prepareJobDirectory(baseDir: string, jobId: number, slug: string) {
  const jobDir = join(baseDir, `${jobId}-${slug}`);
  await rm(jobDir, { recursive: true, force: true });
  await mkdir(jobDir, { recursive: true });

  return jobDir;
}

export async function downloadZip(url: string, jobDir: string, slug: string) {
  const zipPath = join(jobDir, `${slug}.zip`);
  const response = await fetchWithRetry(url);

  if (!response.ok || !response.body) {
    throw new Error(`ZIP download failed: ${response.status} ${await response.text()}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
    createWriteStream(zipPath),
  );
  const bytes = await readFile(zipPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return { zipPath, sha256 };
}

async function fetchWithRetry(url: string) {
  const attempts = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok || !shouldRetryStatus(response.status) || attempt === attempts) {
        return response;
      }

      lastError = new Error(`ZIP download returned retryable status ${response.status}`);
    } catch (error) {
      lastError = error as Error;

      if (attempt === attempts) {
        throw lastError;
      }
    }

    await sleep(1000 * attempt);
  }

  throw lastError ?? new Error("ZIP download failed");
}

function shouldRetryStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractZip(zipPath: string, jobDir: string, slug: string) {
  const extractDir = join(jobDir, "extracted");
  await mkdir(extractDir, { recursive: true });
  await assertSafeZipEntries(zipPath);
  await execFileAsync("unzip", ["-q", zipPath, "-d", extractDir], {
    maxBuffer: 10 * 1024 * 1024,
  });

  const expectedPluginDir = join(extractDir, slug);
  const pluginDir = await pathExists(expectedPluginDir) ? expectedPluginDir : extractDir;
  const jsonPath = join(jobDir, "plugin-check.json");

  return { extractDir, pluginDir, jsonPath };
}

export async function cleanupJobDirectory(jobDir: string) {
  await rm(jobDir, { recursive: true, force: true });
}

async function assertSafeZipEntries(zipPath: string) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], {
    maxBuffer: 20 * 1024 * 1024,
  });

  const base = resolve("/tmp/pluginscore-zip-root");

  for (const entry of stdout.split("\n").filter(Boolean)) {
    if (entry.startsWith("/") || entry.includes(`..${sep}`) || entry === "..") {
      throw new Error(`Unsafe ZIP path: ${entry}`);
    }

    const resolved = resolve(base, entry);
    if (!resolved.startsWith(base)) {
      throw new Error(`Unsafe ZIP path traversal: ${entry}`);
    }
  }
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
