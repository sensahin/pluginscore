import { SCORING_MODEL_VERSION } from "@pluginscore/scoring";
import { PluginScoreApiClient } from "./api-client.js";
import { getConfig } from "./config.js";
import {
  cleanupJobDirectory,
  downloadZip,
  extractZip,
  prepareJobDirectory,
} from "./files.js";
import { runPluginCheck, ScanCommandError } from "./plugin-check.js";
import { fetchPopularPlugins } from "@pluginscore/wporg";

const command = process.argv[2];
const config = getConfig();
const api = new PluginScoreApiClient(config.apiUrl, config.apiInternalToken);

if (command === "seed") {
  await seedPopularPlugins();
} else if (command === "work") {
  await work();
} else if (command === "scan-once") {
  await scanOnce();
} else {
  console.error("Usage: tsx src/index.ts <seed|scan-once|work>");
  process.exit(1);
}

async function seedPopularPlugins() {
  const plugins = await fetchPopularPlugins(config.seedLimit);
  let queued = 0;
  let reused = 0;

  for (const plugin of plugins) {
    const result = await api.enqueue(plugin, {
      reason: "top seed",
      pluginCheckVersion: config.pluginCheckVersion,
      scoringModelVersion: SCORING_MODEL_VERSION,
    });
    if (result.queued) {
      queued += 1;
    } else {
      reused += 1;
    }
  }

  console.log(`Seeded ${plugins.length} popular plugins: ${queued} queued, ${reused} already queued/running.`);
}

async function work() {
  console.log(`Scanner worker polling ${config.apiUrl}; idle sleep is ${config.scanIdleMs / 1000}s.`);

  while (true) {
    try {
      const scanned = await scanOnce();
      if (!scanned) {
        await sleep(config.scanIdleMs);
      }
    } catch (error) {
      console.error(`Scan pass failed: ${(error as Error).message}`);
      await sleep(config.scanIdleMs);
    }
  }
}

async function scanOnce() {
  const job = await api.claimNextJob();

  if (!job) {
    console.log("No queued scan jobs.");
    return false;
  }

  const startedAt = Date.now();
  const jobDir = await prepareJobDirectory(config.tmpDir, job.id, job.slug);

  try {
    console.log(`Scanning ${job.slug}@${job.targetVersion} from ${job.downloadUrl}`);
    const { zipPath, sha256 } = await downloadZip(job.downloadUrl, jobDir, job.slug);
    const extracted = await extractZip(zipPath, jobDir, job.slug);
    const result = await runPluginCheck(
      job,
      {
        jobDir,
        zipPath,
        extractDir: extracted.extractDir,
        pluginDir: extracted.pluginDir,
        jsonPath: extracted.jsonPath,
      },
      config,
    );

    await api.completeJob(job.id, {
      pluginVersion: job.targetVersion,
      pluginCheckVersion: config.pluginCheckVersion,
      scoringModelVersion: SCORING_MODEL_VERSION,
      sourceDownloadUrl: job.downloadUrl,
      sourceSha256: sha256,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      rawReport: result.rawReport,
      stderr: result.stderr,
      findings: result.findings,
    });

    console.log(`Completed ${job.slug}: ${result.findings.length} findings.`);
    return true;
  } catch (error) {
    const scanError = error instanceof ScanCommandError ? error : null;
    try {
      await api.failJob(job.id, {
        message: (error as Error).message,
        timedOut: scanError?.options.timedOut,
        stderr: scanError?.options.stderr,
        durationMs: scanError?.options.durationMs ?? Date.now() - startedAt,
      });
    } catch (reportError) {
      console.error(
        `Unable to mark ${job.slug} failed after scan error: ${(reportError as Error).message}`,
      );
    }
    throw error;
  } finally {
    await cleanupJobDirectory(jobDir);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
