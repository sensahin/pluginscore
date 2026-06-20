import {
  SCORING_MODEL_VERSION,
  scoreAuditSummary,
  summarizeFindings,
  type FindingSeverity,
} from "@pluginscore/scoring";
import { Pool, type PoolClient } from "pg";
import { getConfig } from "./config.js";

type AuditRunRow = {
  id: string;
  plugin_id: string;
};

type FindingRow = {
  audit_run_id: string;
  code: string;
  severity: string;
};

type CountRow = {
  count: string;
};

const config = getConfig();

if (!config.databaseUrl) {
  console.error("DATABASE_URL is required to recompute scores.");
  process.exit(1);
}

const pool = new Pool({ connectionString: config.databaseUrl });
let client: PoolClient | undefined;
let transactionStarted = false;

try {
  const beforeZeroScores = await countZeroScores();
  const auditsResult = await pool.query<AuditRunRow>(
    `
    select id::text, plugin_id::text
    from audit_runs
    where status = 'complete'
    order by id asc
    `,
  );

  const auditRuns = auditsResult.rows;

  if (auditRuns.length === 0) {
    console.log("No completed audit runs found.");
    process.exit(0);
  }

  const findingsResult = await pool.query<FindingRow>(
    `
    select audit_run_id::text, code, severity
    from audit_findings
    where audit_run_id = any($1::bigint[])
    order by audit_run_id asc, id asc
    `,
    [auditRuns.map((run) => Number.parseInt(run.id, 10))],
  );

  const findingsByAuditRun = groupFindingsByAuditRun(findingsResult.rows);

  client = await pool.connect();
  await client.query("begin");
  transactionStarted = true;

  for (const run of auditRuns) {
    const findings = findingsByAuditRun.get(run.id) ?? [];
    const summary = summarizeFindings(
      findings.map((finding) => ({
        code: finding.code,
        severity: normalizeSeverity(finding.severity),
      })),
    );
    const {
      score,
      securityScore,
      repoScore,
      performanceScore,
      maintainabilityScore,
    } = scoreAuditSummary(summary);
    const errorCount = findings.filter((finding) => finding.severity === "error").length;
    const warningCount = findings.filter((finding) => finding.severity === "warning").length;

    await client.query(
      `
      insert into score_snapshots (
        audit_run_id, plugin_id, score, security_score, repo_score,
        performance_score, maintainability_score, total_findings,
        error_count, warning_count
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (audit_run_id) do update set
        plugin_id = excluded.plugin_id,
        score = excluded.score,
        security_score = excluded.security_score,
        repo_score = excluded.repo_score,
        performance_score = excluded.performance_score,
        maintainability_score = excluded.maintainability_score,
        total_findings = excluded.total_findings,
        error_count = excluded.error_count,
        warning_count = excluded.warning_count
      `,
      [
        Number.parseInt(run.id, 10),
        Number.parseInt(run.plugin_id, 10),
        score,
        securityScore,
        repoScore,
        performanceScore,
        maintainabilityScore,
        findings.length,
        errorCount,
        warningCount,
      ],
    );

    await client.query(
      `
      update audit_runs
      set scoring_model_version = $2
      where id = $1
      `,
      [Number.parseInt(run.id, 10), SCORING_MODEL_VERSION],
    );
  }

  await rebuildCurrentScores(client);
  await rebuildPluginRankSnapshots(client);

  await client.query("commit");
  transactionStarted = false;

  const afterZeroScores = await countZeroScores();
  console.log(
    `Recomputed ${auditRuns.length} completed audit score snapshots with ${SCORING_MODEL_VERSION}.`,
  );
  console.log(`Zero-score snapshots: ${beforeZeroScores} -> ${afterZeroScores}.`);
} catch (error) {
  if (transactionStarted && client) {
    await client.query("rollback").catch(() => undefined);
  }
  console.error(`Score recompute failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}

function groupFindingsByAuditRun(rows: FindingRow[]) {
  const grouped = new Map<string, FindingRow[]>();

  for (const row of rows) {
    const findings = grouped.get(row.audit_run_id);

    if (findings) {
      findings.push(row);
    } else {
      grouped.set(row.audit_run_id, [row]);
    }
  }

  return grouped;
}

function normalizeSeverity(severity: string): FindingSeverity {
  if (severity === "error" || severity === "warning") {
    return severity;
  }

  throw new Error(`Unsupported finding severity: ${severity}`);
}

async function countZeroScores() {
  const result = await pool.query<CountRow>(
    `
    select count(*)::text
    from score_snapshots
    where score = 0
    `,
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function rebuildCurrentScores(client: PoolClient) {
  await client.query("delete from plugin_current_scores");
  await client.query(
    `
    insert into plugin_current_scores (
      plugin_id, audit_run_id, score, previous_score, security_score,
      repo_score, performance_score, maintainability_score, total_findings,
      error_count, warning_count, top_issue_title, scanned_at, updated_at
    )
    select
      latest.plugin_id,
      latest.audit_run_id,
      latest.score,
      coalesce(previous.score, latest.score),
      latest.security_score,
      latest.repo_score,
      latest.performance_score,
      latest.maintainability_score,
      latest.total_findings,
      latest.error_count,
      latest.warning_count,
      top_issue.title,
      latest.scanned_at,
      now()
    from (
      select distinct on (ss.plugin_id)
        ss.plugin_id,
        ss.audit_run_id,
        ss.score,
        ss.security_score,
        ss.repo_score,
        ss.performance_score,
        ss.maintainability_score,
        ss.total_findings,
        ss.error_count,
        ss.warning_count,
        coalesce(ar.completed_at, ss.created_at) as scanned_at
      from score_snapshots ss
      join audit_runs ar on ar.id = ss.audit_run_id
      where ar.status = 'complete'
      order by ss.plugin_id, coalesce(ar.completed_at, ss.created_at) desc, ss.audit_run_id desc
    ) latest
    left join lateral (
      select older.score
      from score_snapshots older
      join audit_runs older_run on older_run.id = older.audit_run_id
      where older.plugin_id = latest.plugin_id
        and older.audit_run_id <> latest.audit_run_id
        and older_run.status = 'complete'
      order by coalesce(older_run.completed_at, older.created_at) desc, older.audit_run_id desc
      limit 1
    ) previous on true
    left join lateral (
      select fc.title, count(*) as hits
      from audit_findings af
      join finding_codes fc on fc.code = af.code
      where af.audit_run_id = latest.audit_run_id
      group by fc.title
      order by hits desc, fc.title asc
      limit 1
    ) top_issue on true
    `,
  );
}

async function rebuildPluginRankSnapshots(client: PoolClient) {
  await client.query("delete from plugin_rank_snapshots");
  await client.query(
    `
    insert into plugin_rank_snapshots (ranking_key, rank, plugin_id, sort_value, computed_at)
    select ranking_key, rank, plugin_id, sort_value, now()
    from (
      select
        'best'::text as ranking_key,
        row_number() over (order by pcs.score desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        pcs.score::numeric as sort_value
      from plugins p
      join plugin_current_scores pcs on pcs.plugin_id = p.id

      union all

      select
        'worst'::text as ranking_key,
        row_number() over (order by pcs.score asc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        pcs.score::numeric as sort_value
      from plugins p
      join plugin_current_scores pcs on pcs.plugin_id = p.id

      union all

      select
        'most-improved'::text as ranking_key,
        row_number() over (order by (pcs.score - pcs.previous_score) desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        (pcs.score - pcs.previous_score)::numeric as sort_value
      from plugins p
      join plugin_current_scores pcs on pcs.plugin_id = p.id

      union all

      select
        'most-installed'::text as ranking_key,
        row_number() over (order by coalesce(p.active_installs, 0) desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        coalesce(p.active_installs, 0)::numeric as sort_value
      from plugins p

      union all

      select
        'most-downloaded'::text as ranking_key,
        row_number() over (order by coalesce(p.downloads, 0) desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        coalesce(p.downloads, 0)::numeric as sort_value
      from plugins p

      union all

      select
        'most-issues'::text as ranking_key,
        row_number() over (order by pcs.total_findings desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        pcs.total_findings::numeric as sort_value
      from plugins p
      join plugin_current_scores pcs on pcs.plugin_id = p.id

      union all

      select
        'recently-scanned'::text as ranking_key,
        row_number() over (order by pcs.scanned_at desc, p.slug asc)::integer as rank,
        p.id as plugin_id,
        extract(epoch from pcs.scanned_at)::numeric as sort_value
      from plugins p
      join plugin_current_scores pcs on pcs.plugin_id = p.id
    ) ranked
    `,
  );
}
