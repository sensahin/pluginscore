import type {
  ApiStats,
  AuditFindingsRetentionSummary,
  AuthorDetail,
  AuthorSummary,
  IssueSummary,
  PaginatedResult,
  AuditRunSummary,
  FindingCodeCount,
  PluginDetail,
  PluginScoreHistory,
  NormalizedFinding,
  OperationsRecentFailure,
  OperationsRecentScan,
  OperationsRunningJob,
  OperationsSummary,
  OperationsVersionCount,
  PluginSearchSummary,
  PluginSummary,
  QueueJob,
  ScanCompletePayload,
  ScanFailPayload,
  ScanJobDto,
  TagDetail,
  TagSummary,
  TrackedPluginSummary,
} from "@pluginscore/core";
import { enrichIssueSummary, getIssueEditorial } from "@pluginscore/core";
import {
  SCORING_MODEL_VERSION,
  familyWeights,
  inferFindingFamily,
  scoreAuditSummary,
  summarizeFindings,
} from "@pluginscore/scoring";
import { Pool, type PoolClient } from "pg";
import type {
  EnqueueJobInput,
  ListAuthorsOptions,
  ListQueueOptions,
  ListRecentSearchesOptions,
  ListTagsOptions,
  GetPluginHistoryOptions,
  GetTagOptions,
  ListPluginsOptions,
  PluginScoreStore,
  ListTrackedPluginsOptions,
} from "./types.js";
import type { StoreOptions } from "./index.js";

export class PostgresStore implements PluginScoreStore {
  private pool: Pool;
  private runningJobTimeoutSeconds: number;
  private runningJobMaxAttempts: number;
  private scanRetryBackoffSeconds: number;
  private scanTerminalTimeoutAttempts: number;
  private pluginCheckVersion: string;

  constructor(databaseUrl: string, options: StoreOptions = {}) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.runningJobTimeoutSeconds = options.runningJobTimeoutSeconds ?? 1800;
    this.runningJobMaxAttempts = options.runningJobMaxAttempts ?? 3;
    this.scanRetryBackoffSeconds = options.scanRetryBackoffSeconds ?? 21_600;
    this.scanTerminalTimeoutAttempts = options.scanTerminalTimeoutAttempts ?? 2;
    this.pluginCheckVersion = options.pluginCheckVersion ?? "unknown";
  }

  async health() {
    await this.pool.query("select 1");
    return { ok: true as const, mode: "postgres" as const };
  }

  async stats(): Promise<ApiStats> {
    const result = await this.pool.query(
      `
      select
        (select count(*)::integer from plugins) as indexed_plugins,
        (select count(distinct plugin_id)::integer from audit_runs where status = 'complete') as audited_plugins,
        (select count(*)::integer from audit_runs where status = 'complete') as completed_scans,
        (select count(*)::integer from scan_jobs where status = 'queued') as queued_jobs,
        (select count(*)::integer from scan_jobs where status = 'running') as running_jobs,
        (select count(*)::integer from scan_jobs where status = 'failed') as failed_jobs,
        (select count(*)::integer from finding_codes) as issue_codes,
        (select count(*)::integer from plugin_search_events) as recent_searches
      `,
    );

    return rowToApiStats(result.rows[0] ?? {});
  }

  async auditFindingsRetention(): Promise<AuditFindingsRetentionSummary> {
    const result = await this.pool.query(
      `
      with counts as (
        select
          count(*)::bigint as total_finding_rows,
          count(*) filter (where pcs.audit_run_id is not null)::bigint as current_finding_rows,
          count(*) filter (where pcs.audit_run_id is null)::bigint as stale_finding_rows,
          count(distinct af.audit_run_id) filter (where pcs.audit_run_id is not null)::bigint as current_audit_runs,
          count(distinct af.audit_run_id) filter (where pcs.audit_run_id is null)::bigint as stale_audit_runs,
          count(distinct ar.plugin_id) filter (where pcs.audit_run_id is null)::bigint as plugins_with_stale_findings
        from audit_findings af
        join audit_runs ar on ar.id = af.audit_run_id
        left join plugin_current_scores pcs on pcs.audit_run_id = af.audit_run_id
      ),
      sizes as (
        select pg_total_relation_size('audit_findings'::regclass)::bigint as audit_findings_table_bytes
      )
      select
        counts.*,
        sizes.audit_findings_table_bytes,
        case
          when counts.total_finding_rows > 0
            then round(
              sizes.audit_findings_table_bytes::numeric
              * counts.stale_finding_rows::numeric
              / counts.total_finding_rows::numeric
            )::bigint
          else 0::bigint
        end as estimated_reusable_bytes
      from counts
      cross join sizes
      `,
    );

    return rowToAuditFindingsRetentionSummary(result.rows[0] ?? {});
  }

  async operationsSummary(): Promise<OperationsSummary> {
    const [
      coverageResult,
      queueResult,
      runningResult,
      storageResult,
      distributionResult,
      pluginCheckVersionResult,
      scoringModelVersionResult,
      failureResult,
      recentFailureResult,
      recentCompletedResult,
    ] = await Promise.all([
      this.pool.query(`
        select
          count(*)::integer as indexed_plugins,
          count(pcs.plugin_id)::integer as audited_plugins,
          (count(*) - count(pcs.plugin_id))::integer as unscanned_plugins,
          (select count(*)::integer from audit_runs where status = 'complete') as completed_scans,
          (select count(*)::integer from scan_jobs where status = 'queued') as queued_jobs,
          (select count(*)::integer from scan_jobs where status = 'running') as running_jobs,
          (select count(*)::integer from scan_jobs where status = 'failed') as failed_jobs,
          (
            select count(*)::integer
            from scan_jobs
            where status in ('queued', 'running')
              and reason = 'user submission'
          ) as user_submitted_queued_jobs
        from plugins p
        left join plugin_current_scores pcs on pcs.plugin_id = p.id
      `),
      this.pool.query(
        `
        with recent_complete as (
          select duration_ms, completed_at
          from audit_runs
          where status = 'complete'
            and completed_at > now() - interval '24 hours'
        )
        select
          (select count(*)::integer from scan_jobs where status = 'queued' and run_after <= now()) as queued_ready_jobs,
          (select count(*)::integer from scan_jobs where status = 'queued' and run_after > now()) as queued_delayed_jobs,
          (
            select count(*)::integer
            from scan_jobs
            where status = 'running'
              and updated_at < now() - make_interval(secs => $1::integer)
          ) as stale_running_jobs,
          (select min(created_at) from scan_jobs where status = 'queued') as oldest_queued_at,
          (select max(completed_at) from audit_runs where status = 'complete') as last_completed_at,
          (select max(completed_at) from audit_runs where status in ('failed', 'timeout')) as last_failed_at,
          (select count(*)::integer from recent_complete) as completed_scans_24h,
          (select avg(duration_ms)::numeric from recent_complete where duration_ms is not null) as average_duration_ms,
          (
            select percentile_cont(0.95) within group (order by duration_ms)::numeric
            from recent_complete
            where duration_ms is not null
          ) as p95_duration_ms
        `,
        [this.runningJobTimeoutSeconds],
      ),
      this.pool.query(
        `
        select
          p.slug as plugin,
          p.name,
          sj.target_version as version,
          sj.reason,
          sj.attempts,
          extract(epoch from now() - sj.updated_at) * 1000 as runtime_ms,
          sj.updated_at
        from scan_jobs sj
        join plugins p on p.id = sj.plugin_id
        where sj.status = 'running'
        order by sj.updated_at asc
        limit 8
        `,
      ),
      this.pool.query(`
        select
          pg_database_size(current_database())::bigint as database_bytes,
          pg_total_relation_size('audit_findings'::regclass)::bigint as audit_findings_bytes,
          pg_total_relation_size('audit_runs'::regclass)::bigint as audit_runs_bytes,
          pg_total_relation_size('score_snapshots'::regclass)::bigint as score_snapshots_bytes,
          pg_total_relation_size('scan_jobs'::regclass)::bigint as scan_jobs_bytes,
          coalesce((select sum(pg_column_size(raw_report_json))::bigint from audit_runs), 0::bigint) as raw_report_json_bytes,
          coalesce((select sum(pg_column_size(stderr))::bigint from audit_runs), 0::bigint) as stderr_bytes
      `),
      this.pool.query(`
        with per_run as (
          select audit_run_id, count(*)::integer as finding_count
          from audit_findings
          group by audit_run_id
        )
        select
          coalesce(sum(finding_count), 0)::bigint as total_finding_rows,
          avg(finding_count)::numeric as average_findings_per_stored_audit,
          percentile_cont(0.5) within group (order by finding_count)::numeric as p50_findings_per_stored_audit,
          percentile_cont(0.9) within group (order by finding_count)::numeric as p90_findings_per_stored_audit,
          percentile_cont(0.99) within group (order by finding_count)::numeric as p99_findings_per_stored_audit,
          max(finding_count)::integer as max_findings_per_stored_audit
        from per_run
      `),
      this.pool.query(`
        select plugin_check_version as version, count(*)::integer as count
        from audit_runs
        where status = 'complete'
        group by plugin_check_version
        order by count desc, version asc
        limit 8
      `),
      this.pool.query(`
        select scoring_model_version as version, count(*)::integer as count
        from audit_runs
        where status = 'complete'
        group by scoring_model_version
        order by count desc, version asc
        limit 8
      `),
      this.pool.query(`
        with timeout_groups as (
          select
            plugin_id,
            plugin_version,
            plugin_check_version,
            scoring_model_version,
            count(*)::integer as timeout_count
          from audit_runs
          where status = 'timeout'
          group by plugin_id, plugin_version, plugin_check_version, scoring_model_version
        )
        select
          (select count(*)::integer from audit_runs where status = 'failed') as failed_audit_runs,
          (select count(*)::integer from audit_runs where status = 'timeout') as timeout_audit_runs,
          (select count(*)::integer from timeout_groups where timeout_count >= $1) as repeated_timeout_plugins
        `,
        [this.scanTerminalTimeoutAttempts],
      ),
      this.pool.query(`
        select *
        from (
          select
            p.slug as plugin,
            p.name,
            sj.target_version as version,
            'failed'::text as state,
            sj.attempts,
            left(coalesce(sj.last_error, ''), 240) as last_error,
            sj.updated_at,
            null::timestamptz as completed_at,
            null::integer as duration_ms
          from scan_jobs sj
          join plugins p on p.id = sj.plugin_id
          where sj.status = 'failed'

          union all

          select
            p.slug as plugin,
            p.name,
            ar.plugin_version as version,
            ar.status as state,
            null::integer as attempts,
            left(coalesce(ar.stderr, ''), 240) as last_error,
            null::timestamptz as updated_at,
            ar.completed_at,
            ar.duration_ms
          from audit_runs ar
          join plugins p on p.id = ar.plugin_id
          where ar.status in ('failed', 'timeout')
        ) recent_failures
        order by coalesce(updated_at, completed_at) desc nulls last
        limit 8
      `),
      this.pool.query(`
        select
          p.slug as plugin,
          p.name,
          ar.plugin_version as version,
          ar.completed_at,
          ar.duration_ms,
          ss.score,
          ss.total_findings
        from audit_runs ar
        join plugins p on p.id = ar.plugin_id
        left join score_snapshots ss on ss.audit_run_id = ar.id
        where ar.status = 'complete'
        order by ar.completed_at desc nulls last, ar.id desc
        limit 8
      `),
    ]);

    const coverageRow = coverageResult.rows[0] ?? {};
    const queueRow = queueResult.rows[0] ?? {};
    const storageRow = storageResult.rows[0] ?? {};
    const distributionRow = distributionResult.rows[0] ?? {};
    const indexedPlugins = Number(coverageRow.indexed_plugins ?? 0);
    const auditedPlugins = Number(coverageRow.audited_plugins ?? 0);
    const queuedJobs = Number(coverageRow.queued_jobs ?? 0);
    const completedScans24h = Number(queueRow.completed_scans_24h ?? 0);
    const completedScansPerHour24h = completedScans24h / 24;
    const estimatedDrainHours = completedScansPerHour24h > 0
      ? queuedJobs / completedScansPerHour24h
      : undefined;

    return {
      generatedAt: new Date().toISOString(),
      coverage: {
        indexedPlugins,
        auditedPlugins,
        unscannedPlugins: Number(coverageRow.unscanned_plugins ?? 0),
        completedScans: Number(coverageRow.completed_scans ?? 0),
        coveragePercent: indexedPlugins > 0 ? Math.round((auditedPlugins / indexedPlugins) * 1000) / 10 : 0,
        queuedJobs,
        runningJobs: Number(coverageRow.running_jobs ?? 0),
        failedJobs: Number(coverageRow.failed_jobs ?? 0),
        userSubmittedQueuedJobs: Number(coverageRow.user_submitted_queued_jobs ?? 0),
      },
      queue: {
        queuedReadyJobs: Number(queueRow.queued_ready_jobs ?? 0),
        queuedDelayedJobs: Number(queueRow.queued_delayed_jobs ?? 0),
        staleRunningJobs: Number(queueRow.stale_running_jobs ?? 0),
        oldestQueuedAt: optionalIsoDate(queueRow.oldest_queued_at),
        lastCompletedAt: optionalIsoDate(queueRow.last_completed_at),
        lastFailedAt: optionalIsoDate(queueRow.last_failed_at),
        completedScans24h,
        completedScansPerHour24h: Math.round(completedScansPerHour24h * 100) / 100,
        averageDurationMs: optionalRoundedNumber(queueRow.average_duration_ms),
        p95DurationMs: optionalRoundedNumber(queueRow.p95_duration_ms),
        estimatedDrainHours: estimatedDrainHours === undefined
          ? undefined
          : Math.round(estimatedDrainHours * 10) / 10,
        running: runningResult.rows.map(rowToOperationsRunningJob),
      },
      storage: {
        databaseBytes: Number(storageRow.database_bytes ?? 0),
        auditFindingsBytes: Number(storageRow.audit_findings_bytes ?? 0),
        auditRunsBytes: Number(storageRow.audit_runs_bytes ?? 0),
        scoreSnapshotsBytes: Number(storageRow.score_snapshots_bytes ?? 0),
        scanJobsBytes: Number(storageRow.scan_jobs_bytes ?? 0),
        rawReportJsonBytes: Number(storageRow.raw_report_json_bytes ?? 0),
        stderrBytes: Number(storageRow.stderr_bytes ?? 0),
        totalFindingRows: Number(distributionRow.total_finding_rows ?? 0),
        averageFindingsPerStoredAudit: optionalRoundedNumber(distributionRow.average_findings_per_stored_audit),
        p50FindingsPerStoredAudit: optionalRoundedNumber(distributionRow.p50_findings_per_stored_audit),
        p90FindingsPerStoredAudit: optionalRoundedNumber(distributionRow.p90_findings_per_stored_audit),
        p99FindingsPerStoredAudit: optionalRoundedNumber(distributionRow.p99_findings_per_stored_audit),
        maxFindingsPerStoredAudit: optionalRoundedNumber(distributionRow.max_findings_per_stored_audit),
      },
      versions: {
        apiPluginCheckVersion: this.pluginCheckVersion,
        scoringModelVersion: SCORING_MODEL_VERSION,
        pluginCheckVersions: pluginCheckVersionResult.rows.map(rowToOperationsVersionCount),
        scoringModelVersions: scoringModelVersionResult.rows.map(rowToOperationsVersionCount),
      },
      retryPolicy: {
        runningJobTimeoutSeconds: this.runningJobTimeoutSeconds,
        runningJobMaxAttempts: this.runningJobMaxAttempts,
        scanRetryBackoffSeconds: this.scanRetryBackoffSeconds,
        scanTerminalTimeoutAttempts: this.scanTerminalTimeoutAttempts,
      },
      failures: {
        failedAuditRuns: Number(failureResult.rows[0]?.failed_audit_runs ?? 0),
        timeoutAuditRuns: Number(failureResult.rows[0]?.timeout_audit_runs ?? 0),
        repeatedTimeoutPlugins: Number(failureResult.rows[0]?.repeated_timeout_plugins ?? 0),
        recent: recentFailureResult.rows.map(rowToOperationsRecentFailure),
      },
      recentCompleted: recentCompletedResult.rows.map(rowToOperationsRecentScan),
    };
  }

  async listPlugins(options: ListPluginsOptions): Promise<PaginatedResult<PluginSummary>> {
    const page = Math.max(1, options.page);
    const perPage = Math.max(1, options.perPage);
    const rawSearchQuery = options.query?.trim() || null;
    const searchPattern = rawSearchQuery ? `%${escapeLikePattern(rawSearchQuery)}%` : null;
    const tagSlug = options.tag ? normalizeTagSlug(options.tag) : null;
    const authorName = options.author?.trim() || null;
    const issueCode = options.issueCode?.trim() || null;
    const issueFamily = options.issueFamily ? normalizeTagSlug(options.issueFamily) : null;
    const rankingKey = rankSnapshotKeyForSort(options.sort);
    const useRankSnapshot =
      rankingKey !== undefined &&
      !searchPattern &&
      !tagSlug &&
      !authorName &&
      !issueCode &&
      !issueFamily &&
      (options.sort === "installs_desc" || options.sort === "downloads_desc" || Boolean(options.auditedOnly));

    if (useRankSnapshot) {
      return this.listRankedPlugins(rankingKey, page, perPage);
    }

    const values: unknown[] = [];
    const where = this.buildPluginListWhere({
      values,
      auditedOnly: options.auditedOnly ?? false,
      searchPattern,
      tagSlug,
      authorName,
      issueCode,
      issueFamily,
    });
    const countResult = await this.pool.query(
      `
      select count(*)::integer as total
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      where ${where}
      `,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const orderBy = pluginListOrderBy(options.sort, rawSearchQuery, values);
    const limitParam = values.push(perPage);
    const offsetParam = values.push((page - 1) * perPage);
    const result = await this.pool.query(
      `
      ${pluginListSelectSql()}
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      where ${where}
      order by ${orderBy}
      limit $${limitParam}
      offset $${offsetParam}
      `,
      values,
    );

    return toPaginatedResult(result.rows.map(rowToPluginSummary), total, page, perPage);
  }

  private async listRankedPlugins(
    rankingKey: string,
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<PluginSummary>> {
    const startRank = (page - 1) * perPage + 1;
    const endRank = page * perPage;
    const countResult = await this.pool.query(
      `
      select count(*)::integer as total
      from plugin_rank_snapshots
      where ranking_key = $1
      `,
      [rankingKey],
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const result = await this.pool.query(
      `
      ${pluginListSelectSql("prs.rank")}
      from plugin_rank_snapshots prs
      join plugins p on p.id = prs.plugin_id
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      where prs.ranking_key = $1
        and prs.rank between $2 and $3
      order by prs.rank asc
      `,
      [rankingKey, startRank, endRank],
    );

    return toPaginatedResult(result.rows.map(rowToPluginSummary), total, page, perPage);
  }

  private buildPluginListWhere({
    values,
    auditedOnly,
    searchPattern,
    tagSlug,
    authorName,
    issueCode,
    issueFamily,
  }: {
    values: unknown[];
    auditedOnly: boolean;
    searchPattern: string | null;
    tagSlug: string | null;
    authorName: string | null;
    issueCode: string | null;
    issueFamily: string | null;
  }) {
    const where = ["($1::boolean = false or pcs.audit_run_id is not null)"];
    values.push(auditedOnly);

    if (searchPattern) {
      const searchParam = values.push(searchPattern);
      where.push(`
        (
          p.slug ilike $${searchParam} escape '\\'
          or p.name ilike $${searchParam} escape '\\'
          or p.short_description ilike $${searchParam} escape '\\'
          or p.author ilike $${searchParam} escape '\\'
          or exists (
            select 1
            from plugin_tags search_pt
            join tags search_t on search_t.id = search_pt.tag_id
            where search_pt.plugin_id = p.id
              and (
                search_t.slug ilike $${searchParam} escape '\\'
                or search_t.name ilike $${searchParam} escape '\\'
              )
          )
        )
      `);
    }

    if (tagSlug) {
      const tagParam = values.push(tagSlug);
      where.push(`
        exists (
          select 1
          from plugin_tags filter_pt
          join tags filter_t on filter_t.id = filter_pt.tag_id
          where filter_pt.plugin_id = p.id
            and filter_t.slug = $${tagParam}
        )
      `);
    }

    if (authorName) {
      const authorParam = values.push(authorName);
      where.push(`lower(p.author) = lower($${authorParam})`);
    }

    if (issueCode) {
      const issueParam = values.push(issueCode);
      where.push(`
        exists (
          select 1
          from audit_findings issue_af
          where issue_af.audit_run_id = pcs.audit_run_id
            and issue_af.code = $${issueParam}
        )
      `);
    }

    if (issueFamily) {
      const familyParam = values.push(issueFamily);
      where.push(`
        exists (
          select 1
          from audit_findings family_af
          join finding_codes family_fc on family_fc.code = family_af.code
          where family_af.audit_run_id = pcs.audit_run_id
            and regexp_replace(lower(family_fc.family), '[^a-z0-9]+', '-', 'g') = $${familyParam}
        )
      `);
    }

    return where.map((clause) => `(${clause})`).join("\n      and ");
  }

  async getPlugin(slug: string): Promise<PluginDetail | null> {
    const pluginResult = await this.pool.query(
      `
      ${pluginListSelectSql()}
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      where p.slug = $1
      limit 1
      `,
      [slug],
    );

    const row = pluginResult.rows[0];
    if (!row) {
      return null;
    }

    const plugin: PluginDetail = {
      ...rowToPluginSummary(row),
      scores: rowToScoreBreakdown(row),
      rankings: await this.getPluginRankings(Number(row.id), optionalNumber(row.audit_run_id) !== undefined),
    };

    const auditRunId = optionalNumber(row.audit_run_id);
    if (auditRunId) {
      const [audit, topFindings] = await Promise.all([
        this.getAuditRunSummary(auditRunId),
        this.getTopFindingCounts(auditRunId),
      ]);
      plugin.latestAudit = audit ?? undefined;
      plugin.topFindings = topFindings;
    }

    return plugin;
  }

  async getPluginHistory(slug: string, options: GetPluginHistoryOptions): Promise<PluginScoreHistory | null> {
    const pluginResult = await this.pool.query<{ slug: string }>(
      `
      select slug
      from plugins
      where slug = $1
      limit 1
      `,
      [slug],
    );

    const pluginSlug = pluginResult.rows[0]?.slug;

    if (!pluginSlug) {
      return null;
    }

    const historyResult = await this.pool.query(
      `
      with latest_points as (
        select
          ar.id as audit_run_id,
          ar.plugin_version,
          ar.plugin_check_version,
          ar.scoring_model_version,
          ar.duration_ms,
          coalesce(ar.completed_at, ss.created_at) as scanned_at,
          ss.score,
          ss.security_score,
          ss.repo_score,
          ss.performance_score,
          ss.maintainability_score,
          ss.total_findings,
          ss.error_count,
          ss.warning_count
        from plugins p
        join score_snapshots ss on ss.plugin_id = p.id
        join audit_runs ar on ar.id = ss.audit_run_id
        where p.slug = $1
          and ar.status = 'complete'
        order by coalesce(ar.completed_at, ss.created_at) desc, ar.id desc
        limit $2
      )
      select *
      from latest_points
      order by scanned_at asc, audit_run_id asc
      `,
      [pluginSlug, options.limit],
    );

    return {
      slug: pluginSlug,
      history: historyResult.rows.map(rowToPluginScoreHistoryPoint),
    };
  }

  async recordSearch(slug: string) {
    const result = await this.pool.query<{ id: number }>(
      `
      insert into plugin_search_events (plugin_id, query)
      select id, slug
      from plugins
      where slug = $1
      returning id
      `,
      [slug],
    );

    return { recorded: Boolean(result.rows[0]) };
  }

  async listRecentSearches(options: ListRecentSearchesOptions): Promise<PluginSearchSummary[]> {
    const result = await this.pool.query(
      `
      ${pluginListSelectSql("recent.searched_at, recent.search_count")}
      from (
        select
          plugin_id,
          max(created_at) as searched_at,
          count(*)::integer as search_count
        from plugin_search_events
        where plugin_id is not null
        group by plugin_id
        order by max(created_at) desc
        limit $1
      ) recent
      join plugins p on p.id = recent.plugin_id
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      order by recent.searched_at desc
      `,
      [options.limit],
    );

    return result.rows.map(rowToPluginSearchSummary);
  }

  async listAuthors(options: ListAuthorsOptions): Promise<AuthorSummary[]> {
    const result = await this.pool.query(
      `
      select
        p.author as name,
        count(*)::integer as plugin_count,
        count(pcs.audit_run_id)::integer as audited_plugin_count,
        coalesce(sum(p.active_installs), 0)::bigint as active_installs,
        coalesce(sum(p.downloads), 0)::bigint as downloads,
        round(avg(pcs.score) filter (where pcs.audit_run_id is not null))::integer as average_score,
        coalesce(sum(pcs.total_findings), 0)::integer as total_findings,
        coalesce(sum(pcs.error_count), 0)::integer as total_errors,
        coalesce(sum(pcs.warning_count), 0)::integer as total_warnings
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      where p.author is not null and btrim(p.author) <> ''
      group by p.author
      order by plugin_count desc, active_installs desc, p.author asc
      limit $1
      `,
      [options.limit],
    );

    return result.rows.map(rowToAuthorSummary);
  }

  async getAuthor(authorName: string): Promise<AuthorDetail | null> {
    const normalized = authorName.trim();

    if (!normalized) {
      return null;
    }

    const summaryResult = await this.pool.query(
      `
      select
        coalesce(min(p.author), $1) as name,
        count(*)::integer as plugin_count,
        count(pcs.audit_run_id)::integer as audited_plugin_count,
        coalesce(sum(p.active_installs), 0)::bigint as active_installs,
        coalesce(sum(p.downloads), 0)::bigint as downloads,
        round(avg(pcs.score) filter (where pcs.audit_run_id is not null))::integer as average_score,
        coalesce(sum(pcs.total_findings), 0)::integer as total_findings,
        coalesce(sum(pcs.error_count), 0)::integer as total_errors,
        coalesce(sum(pcs.warning_count), 0)::integer as total_warnings
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      where lower(p.author) = lower($1)
      `,
      [normalized],
    );
    const summaryRow = summaryResult.rows[0];

    if (!summaryRow || Number(summaryRow.plugin_count ?? 0) === 0) {
      return null;
    }

    const pluginResult = await this.pool.query(
      `
      ${pluginListSelectSql()}
      from plugins p
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      where lower(p.author) = lower($1)
      order by coalesce(p.active_installs, 0) desc, p.name asc
      limit 200
      `,
      [normalized],
    );

    const summary = rowToAuthorSummary(summaryRow);

    return {
      ...summary,
      plugins: pluginResult.rows.map(rowToPluginSummary),
    };
  }

  async listTags(options: ListTagsOptions): Promise<TagSummary[]> {
    const result = await this.pool.query(
      `
      select
        t.slug,
        t.name,
        count(pt.plugin_id)::integer as plugin_count,
        count(pcs.audit_run_id)::integer as audited_plugin_count,
        coalesce(sum(p.active_installs), 0)::bigint as active_installs,
        round(avg(pcs.score) filter (where pcs.audit_run_id is not null))::integer as average_score
      from tags t
      join plugin_tags pt on pt.tag_id = t.id
      join plugins p on p.id = pt.plugin_id
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      group by t.id, t.slug, t.name
      having count(pt.plugin_id) >= $2
      order by plugin_count desc, active_installs desc, t.name asc
      limit $1
      `,
      [options.limit, options.minimumPlugins ?? 1],
    );

    return result.rows.map(rowToTagSummary);
  }

  async getTag(tagSlug: string, options: GetTagOptions): Promise<TagDetail | null> {
    const normalizedSlug = normalizeTagSlug(tagSlug);

    if (!normalizedSlug) {
      return null;
    }

    const tagResult = await this.pool.query(
      `
      select
        t.id,
        t.slug,
        t.name,
        count(pt.plugin_id)::integer as plugin_count,
        count(pcs.audit_run_id)::integer as audited_plugin_count,
        coalesce(sum(p.active_installs), 0)::bigint as active_installs,
        round(avg(pcs.score) filter (where pcs.audit_run_id is not null))::integer as average_score
      from tags t
      join plugin_tags pt on pt.tag_id = t.id
      join plugins p on p.id = pt.plugin_id
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      where t.slug = $1
      group by t.id, t.slug, t.name
      limit 1
      `,
      [normalizedSlug],
    );

    const tagRow = tagResult.rows[0];
    if (!tagRow) {
      return null;
    }

    const auditedOnly = options.sort === "score_desc" || options.sort === "scanned_desc" || options.sort === "issues_desc";
    const orderBy = {
      score_desc: "coalesce(pcs.score, 0) desc, p.slug asc",
      installs_desc: "coalesce(p.active_installs, 0) desc, p.slug asc",
      scanned_desc: "pcs.scanned_at desc nulls last, p.slug asc",
      issues_desc: "coalesce(pcs.total_findings, 0) desc, p.slug asc",
    }[options.sort];

    const pluginResult = await this.pool.query(
      `
      ${pluginListSelectSql()}
      from plugin_tags current_tag
      join tags current_t on current_t.id = current_tag.tag_id
      join plugins p on p.id = current_tag.plugin_id
      left join plugin_current_scores pcs on pcs.plugin_id = p.id
      ${pluginTagsSelectSql()}
      where current_t.slug = $1
        and ($3::boolean = false or pcs.audit_run_id is not null)
      order by ${orderBy}
      limit $2
      `,
      [normalizedSlug, options.limit, auditedOnly],
    );

    return {
      ...rowToTagSummary(tagRow),
      plugins: pluginResult.rows.map(rowToPluginSummary),
    };
  }

  async listQueue(options: ListQueueOptions): Promise<QueueJob[]> {
    const result = await this.pool.query(
      `
      select
        p.slug as plugin,
        sj.target_version as version,
        sj.status,
        sj.reason,
        case
          when sj.status = 'queued' then null
          when sj.status = 'running' then extract(epoch from (now() - sj.updated_at)) * 1000
          else coalesce(ar.duration_ms::double precision, extract(epoch from (sj.updated_at - sj.created_at)) * 1000)
        end as runtime_ms
      from scan_jobs sj
      join plugins p on p.id = sj.plugin_id
      left join lateral (
        select duration_ms
        from audit_runs ar
        where ar.plugin_id = sj.plugin_id
          and ar.plugin_version = sj.target_version
        order by ar.completed_at desc nulls last, ar.id desc
        limit 1
      ) ar on true
      order by
        case sj.status
          when 'running' then 0
          when 'queued' then 1
          when 'failed' then 2
          when 'complete' then 3
          else 4
        end,
        sj.updated_at desc,
        sj.id desc
      limit $1
      `,
      [options.limit],
    );

    return result.rows.map(rowToQueueJob);
  }

  async listIssues() {
    const result = await this.pool.query(`
      select
        fc.code,
        fc.family,
        fc.title,
        fc.severity_weight,
        fc.explanation,
        fc.fix_guidance,
        count(distinct pcs.plugin_id)::integer as affected_plugins
      from finding_codes fc
      left join audit_findings af on af.code = fc.code
      left join plugin_current_scores pcs on pcs.audit_run_id = af.audit_run_id
      group by fc.code
      order by affected_plugins desc, fc.code asc
    `);

    return result.rows.map(rowToIssueSummary);
  }

  async getIssue(code: string) {
    const issues = await this.listIssues();
    return issues.find((issue) => issue.code === decodeURIComponent(code)) ?? null;
  }

  async listTrackedPlugins(options: ListTrackedPluginsOptions): Promise<TrackedPluginSummary[]> {
    const result = await this.pool.query(
      `
      select slug, current_version, updated_at
      from plugins
      order by updated_at desc, slug asc
      limit $1
      `,
      [options.limit],
    );

    return result.rows.map(rowToTrackedPluginSummary);
  }

  async enqueueJob(input: EnqueueJobInput) {
    return withTransaction(this.pool, async (client) => {
      const pluginResult = await client.query<{ id: number }>(
        `
        insert into plugins (
          slug, name, short_description, icon_url, banner_url,
          author, author_url, homepage_url, requires_wp, tested_wp,
          requires_php, rating, rating_count, support_threads,
          support_threads_resolved, current_version, active_installs,
          downloads, last_updated_at, wporg_added_at, download_url, updated_at
        )
        values (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20, $21, now()
        )
        on conflict (slug) do update set
          name = excluded.name,
          short_description = excluded.short_description,
          icon_url = excluded.icon_url,
          banner_url = excluded.banner_url,
          author = excluded.author,
          author_url = excluded.author_url,
          homepage_url = excluded.homepage_url,
          requires_wp = excluded.requires_wp,
          tested_wp = excluded.tested_wp,
          requires_php = excluded.requires_php,
          rating = excluded.rating,
          rating_count = excluded.rating_count,
          support_threads = excluded.support_threads,
          support_threads_resolved = excluded.support_threads_resolved,
          current_version = excluded.current_version,
          active_installs = excluded.active_installs,
          downloads = excluded.downloads,
          last_updated_at = excluded.last_updated_at,
          wporg_added_at = excluded.wporg_added_at,
          download_url = excluded.download_url,
          updated_at = now()
        returning id
        `,
        [
          input.slug,
          input.name,
          input.shortDescription ?? null,
          input.iconUrl ?? null,
          input.bannerUrl ?? null,
          input.author ?? null,
          input.authorUrl ?? null,
          input.homepageUrl ?? null,
          input.requiresWp ?? null,
          input.testedWp ?? null,
          input.requiresPhp ?? null,
          input.rating ?? null,
          input.ratingCount ?? null,
          input.supportThreads ?? null,
          input.supportThreadsResolved ?? null,
          input.version,
          input.activeInstalls ?? null,
          input.downloaded ?? null,
          parseOptionalDate(input.lastUpdated),
          parseOptionalDate(input.addedAt),
          input.downloadLink,
        ],
      );

      const pluginId = pluginResult.rows[0]?.id;
      if (!pluginId) {
        throw new Error(`Unable to upsert plugin ${input.slug}`);
      }

      await replacePluginTags(client, pluginId, input.tags ?? []);

      const existing = await client.query<{ id: number }>(
        `
        select id
        from scan_jobs
        where plugin_id = $1
          and target_version = $2
          and status in ('queued', 'running')
        limit 1
        `,
        [pluginId, input.version],
      );

      if (existing.rows[0]) {
        return { id: Number(existing.rows[0].id), queued: false };
      }

      if (!input.force) {
        const completed = await client.query<{ id: number }>(
          `
          select ar.id
          from audit_runs ar
          where ar.plugin_id = $1
            and ar.plugin_version = $2
            and ar.status = 'complete'
            and ($3::text is null or ar.plugin_check_version = $3)
            and ($4::text is null or ar.scoring_model_version = $4)
          order by ar.completed_at desc nulls last, ar.id desc
          limit 1
          `,
          [
            pluginId,
            input.version,
            input.pluginCheckVersion ?? null,
            input.scoringModelVersion ?? null,
          ],
        );

        if (completed.rows[0]) {
          return { id: 0, queued: false };
        }

        const retrySuppression = await this.getRetrySuppression(client, {
          pluginId,
          pluginVersion: input.version,
          pluginCheckVersion: input.pluginCheckVersion ?? null,
          scoringModelVersion: input.scoringModelVersion ?? null,
        });

        if (retrySuppression) {
          return { id: 0, queued: false };
        }
      }

      const job = await client.query<{ id: number }>(
        `
        insert into scan_jobs (plugin_id, target_version, reason, status, priority)
        values ($1, $2, $3, 'queued', $4)
        returning id
        `,
        [pluginId, input.version, input.reason, input.priority ?? 100],
      );

      return { id: Number(job.rows[0]?.id ?? 0), queued: true };
    });
  }

  private async getRetrySuppression(
    client: PoolClient,
    {
      pluginId,
      pluginVersion,
      pluginCheckVersion,
      scoringModelVersion,
    }: {
      pluginId: number;
      pluginVersion: string;
      pluginCheckVersion: string | null;
      scoringModelVersion: string | null;
    },
  ) {
    const result = await client.query<{
      timeout_count: number;
      recent_failure_count: number;
    }>(
      `
      select
        count(*) filter (where status = 'timeout')::integer as timeout_count,
        count(*) filter (
          where completed_at > now() - make_interval(secs => $5::integer)
        )::integer as recent_failure_count
      from audit_runs
      where plugin_id = $1
        and plugin_version = $2
        and status in ('failed', 'timeout')
        and ($3::text is null or plugin_check_version = $3)
        and ($4::text is null or scoring_model_version = $4)
      `,
      [
        pluginId,
        pluginVersion,
        pluginCheckVersion,
        scoringModelVersion,
        Math.max(0, this.scanRetryBackoffSeconds),
      ],
    );

    const row = result.rows[0] ?? { timeout_count: 0, recent_failure_count: 0 };
    const timeoutCount = Number(row.timeout_count ?? 0);
    const recentFailureCount = Number(row.recent_failure_count ?? 0);

    if (this.scanTerminalTimeoutAttempts > 0 && timeoutCount >= this.scanTerminalTimeoutAttempts) {
      return true;
    }

    return this.scanRetryBackoffSeconds > 0 && recentFailureCount > 0;
  }

  async claimNextJob(): Promise<ScanJobDto | null> {
    return withTransaction(this.pool, async (client) => {
      await this.recoverStaleRunningJobs(client);

      const result = await client.query<ScanJobDto>(
        `
        with next_job as (
          select sj.id
          from scan_jobs sj
          where sj.status = 'queued'
            and sj.run_after <= now()
          order by sj.priority asc, sj.run_after asc, sj.id asc
          limit 1
          for update skip locked
        )
        update scan_jobs sj
        set status = 'running', attempts = attempts + 1, updated_at = now()
        from next_job, plugins p
        where sj.id = next_job.id
          and p.id = sj.plugin_id
        returning
          sj.id,
          p.id as "pluginId",
          p.slug,
          p.name,
          sj.target_version as "targetVersion",
          sj.reason,
          p.download_url as "downloadUrl",
          sj.attempts
        `,
      );

      return result.rows[0] ?? null;
    });
  }

  private async recoverStaleRunningJobs(client: PoolClient) {
    await client.query(
      `
      update scan_jobs
      set
        status = 'failed',
        last_error = coalesce(last_error, 'Running job exceeded stale recovery attempts.'),
        updated_at = now()
      where status = 'running'
        and attempts >= $2
        and updated_at < now() - make_interval(secs => $1::integer)
      `,
      [this.runningJobTimeoutSeconds, this.runningJobMaxAttempts],
    );

    await client.query(
      `
      update scan_jobs
      set
        status = 'queued',
        run_after = now(),
        last_error = coalesce(last_error, 'Requeued after stale running job timeout.'),
        updated_at = now()
      where status = 'running'
        and attempts < $2
        and updated_at < now() - make_interval(secs => $1::integer)
      `,
      [this.runningJobTimeoutSeconds, this.runningJobMaxAttempts],
    );
  }

  async completeJob(id: number, payload: ScanCompletePayload) {
    await withTransaction(this.pool, async (client) => {
      const job = await getJobForUpdate(client, id);

      if (job.status === "complete") {
        return;
      }

      if (job.status !== "running") {
        return;
      }

      const summary = summarizeFindings(payload.findings);
      const {
        score,
        securityScore,
        repoScore,
        performanceScore,
        maintainabilityScore,
      } = scoreAuditSummary(summary);
      const errorCount = payload.findings.filter((finding) => finding.severity === "error").length;
      const warningCount = payload.findings.filter((finding) => finding.severity === "warning").length;

      const runResult = await client.query<{ id: number }>(
        `
        insert into audit_runs (
          plugin_id, plugin_version, plugin_check_version,
          scoring_model_version, source_download_url, source_sha256,
          status, exit_code, timed_out, duration_ms, stderr,
          raw_report_object_key, raw_report_json, started_at, completed_at
        )
        values (
          $1, $2, $3, $4, $5, $6,
          'complete', $7, false, $8, $9,
          $10, $11::jsonb, now(), now()
        )
        returning id
        `,
        [
          job.plugin_id,
          payload.pluginVersion,
          payload.pluginCheckVersion,
          payload.scoringModelVersion,
          payload.sourceDownloadUrl,
          payload.sourceSha256 ?? null,
          payload.exitCode,
          payload.durationMs,
          payload.stderr ?? null,
          payload.rawReportObjectKey ?? null,
          payload.rawReport === undefined ? null : JSON.stringify(payload.rawReport),
        ],
      );

      const auditRunId = runResult.rows[0]?.id;
      if (!auditRunId) {
        throw new Error("Unable to create audit run");
      }

      for (const finding of payload.findings) {
        await upsertFindingCode(client, finding);
        await client.query(
          `
          insert into audit_findings (
            audit_run_id, code, type, severity, file_path,
            line, column_number, message, docs_url
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            auditRunId,
            finding.code,
            finding.type,
            finding.severity,
            finding.filePath ?? null,
            finding.line ?? null,
            finding.column ?? null,
            finding.message,
            finding.docsUrl ?? null,
          ],
        );
      }

      await client.query(
        `
        insert into score_snapshots (
          audit_run_id, plugin_id, score, security_score, repo_score,
          performance_score, maintainability_score, total_findings,
          error_count, warning_count
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          auditRunId,
          job.plugin_id,
          score,
          securityScore,
          repoScore,
          performanceScore,
          maintainabilityScore,
          payload.findings.length,
          errorCount,
          warningCount,
        ],
      );

      await refreshCurrentScoreForPlugin(client, job.plugin_id);
      await pruneStaleAuditFindingsForPlugin(client, job.plugin_id);
      await refreshPluginRankSnapshots(client);

      await client.query(
        `
        update scan_jobs
        set status = 'complete', updated_at = now()
        where id = $1
        `,
        [id],
      );
    });
  }

  async failJob(id: number, payload: ScanFailPayload) {
    await withTransaction(this.pool, async (client) => {
      const job = await getJobForUpdate(client, id);

      if (job.status === "complete" || job.status === "failed") {
        return job;
      }

      if (job.status !== "running") {
        return job;
      }

      await client.query(
        `
        insert into audit_runs (
          plugin_id, plugin_version, plugin_check_version,
          scoring_model_version, source_download_url, status,
          timed_out, duration_ms, stderr, completed_at
        )
        select
          p.id, sj.target_version, $2, $3, p.download_url,
          case when $4 then 'timeout' else 'failed' end,
          $4, $5, $6, now()
        from scan_jobs sj
        join plugins p on p.id = sj.plugin_id
        where sj.id = $1
        `,
        [
          id,
          payload.pluginCheckVersion ?? "unknown",
          payload.scoringModelVersion ?? SCORING_MODEL_VERSION,
          payload.timedOut ?? false,
          payload.durationMs ?? null,
          payload.stderr ?? payload.message,
        ],
      );

      await client.query(
        `
        update scan_jobs
        set status = 'failed', last_error = $2, updated_at = now()
        where id = $1
        `,
        [id, payload.message],
      );

      return job;
    });
  }

  async close() {
    await this.pool.end();
  }

  private async getAuditRunSummary(id: number): Promise<AuditRunSummary | null> {
    const result = await this.pool.query(
      `
      select
        id,
        status,
        plugin_version,
        plugin_check_version,
        scoring_model_version,
        duration_ms,
        exit_code,
        timed_out,
        source_sha256,
        raw_report_object_key,
        raw_report_json is not null as raw_report_stored,
        completed_at,
        left(coalesce(stderr, ''), 800) as stderr_preview
      from audit_runs
      where id = $1
      limit 1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? rowToAuditRunSummary(row) : null;
  }

  private async getTopFindingCounts(auditRunId: number): Promise<FindingCodeCount[]> {
    const result = await this.pool.query(
      `
      select
        af.code,
        fc.title,
        fc.family,
        af.severity,
        count(*)::integer as count,
        min(af.message) as sample_message,
        max(af.docs_url) as docs_url
      from audit_findings af
      join finding_codes fc on fc.code = af.code
      where af.audit_run_id = $1
      group by af.code, fc.title, fc.family, af.severity
      order by count desc, af.code asc
      limit 25
      `,
      [auditRunId],
    );

    return result.rows.map(rowToFindingCodeCount);
  }

  private async getPluginRankings(pluginId: number, audited: boolean) {
    const [scoreResult, popularityResult, tagResult] = await Promise.all([
      audited
        ? this.pool.query(
            `
            select
              prs.rank,
              totals.total
            from plugin_rank_snapshots prs
            cross join (
              select count(*)::integer as total
              from plugin_rank_snapshots
              where ranking_key = 'best'
            ) totals
            where prs.ranking_key = 'best'
              and prs.plugin_id = $1
            limit 1
            `,
            [pluginId],
          )
        : Promise.resolve({ rows: [] }),
      this.pool.query(
        `
        select
          prs.rank,
          totals.total
        from plugin_rank_snapshots prs
        cross join (
          select count(*)::integer as total
          from plugin_rank_snapshots
          where ranking_key = 'most-installed'
        ) totals
        where prs.ranking_key = 'most-installed'
          and prs.plugin_id = $1
        limit 1
        `,
        [pluginId],
      ),
      this.pool.query(
        `
        with current_tags as (
          select t.id, t.slug, t.name
          from plugin_tags pt
          join tags t on t.id = pt.tag_id
          where pt.plugin_id = $1
        ),
        score_ranked as (
          select
            pt.tag_id,
            p.id as plugin_id,
            rank() over (partition by pt.tag_id order by pcs.score desc, p.slug asc)::integer as score_rank,
            count(*) over (partition by pt.tag_id)::integer as score_total
          from plugin_tags pt
          join plugins p on p.id = pt.plugin_id
          join plugin_current_scores pcs on pcs.plugin_id = p.id
          where pt.tag_id in (select id from current_tags)
        ),
        popularity_ranked as (
          select
            pt.tag_id,
            p.id as plugin_id,
            rank() over (partition by pt.tag_id order by coalesce(p.active_installs, 0) desc, p.slug asc)::integer as popularity_rank,
            count(*) over (partition by pt.tag_id)::integer as popularity_total
          from plugin_tags pt
          join plugins p on p.id = pt.plugin_id
          where pt.tag_id in (select id from current_tags)
        )
        select
          ct.slug,
          ct.name,
          sr.score_rank,
          sr.score_total,
          pr.popularity_rank,
          pr.popularity_total
        from current_tags ct
        left join score_ranked sr on sr.tag_id = ct.id and sr.plugin_id = $1
        left join popularity_ranked pr on pr.tag_id = ct.id and pr.plugin_id = $1
        order by ct.name asc
        `,
        [pluginId],
      ),
    ]);

    const scoreRow = scoreResult.rows[0];
    const popularityRow = popularityResult.rows[0];

    return {
      overallScore: scoreRow
        ? { rank: Number(scoreRow.rank), total: Number(scoreRow.total) }
        : undefined,
      popularity: popularityRow
        ? { rank: Number(popularityRow.rank), total: Number(popularityRow.total) }
        : undefined,
      tags: tagResult.rows.map((row) => ({
        slug: String(row.slug),
        name: String(row.name),
        scoreRank:
          row.score_rank !== null && row.score_rank !== undefined
            ? { rank: Number(row.score_rank), total: Number(row.score_total) }
            : undefined,
        popularityRank:
          row.popularity_rank !== null && row.popularity_rank !== undefined
            ? { rank: Number(row.popularity_rank), total: Number(row.popularity_total) }
            : undefined,
      })),
    };
  }
}

async function withTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getJobForUpdate(client: PoolClient, id: number) {
  const result = await client.query<{ id: number; plugin_id: number; status: string }>(
    "select id, plugin_id, status from scan_jobs where id = $1 for update",
    [id],
  );
  const job = result.rows[0];

  if (!job) {
    throw new Error(`Scan job ${id} not found`);
  }

  return job;
}

async function refreshCurrentScoreForPlugin(client: PoolClient, pluginId: number) {
  const result = await client.query(
    `
    with latest as (
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
      where ss.plugin_id = $1
        and ar.status = 'complete'
      order by ss.plugin_id, coalesce(ar.completed_at, ss.created_at) desc, ss.audit_run_id desc
    )
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
    from latest
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
    on conflict (plugin_id) do update set
      audit_run_id = excluded.audit_run_id,
      score = excluded.score,
      previous_score = excluded.previous_score,
      security_score = excluded.security_score,
      repo_score = excluded.repo_score,
      performance_score = excluded.performance_score,
      maintainability_score = excluded.maintainability_score,
      total_findings = excluded.total_findings,
      error_count = excluded.error_count,
      warning_count = excluded.warning_count,
      top_issue_title = excluded.top_issue_title,
      scanned_at = excluded.scanned_at,
      updated_at = now()
    returning plugin_id
    `,
    [pluginId],
  );

  if (result.rowCount === 0) {
    await client.query("delete from plugin_current_scores where plugin_id = $1", [pluginId]);
  }
}

async function pruneStaleAuditFindingsForPlugin(client: PoolClient, pluginId: number) {
  await client.query(
    `
    delete from audit_findings af
    using audit_runs ar, plugin_current_scores pcs
    where af.audit_run_id = ar.id
      and pcs.plugin_id = ar.plugin_id
      and ar.plugin_id = $1
      and af.audit_run_id <> pcs.audit_run_id
    `,
    [pluginId],
  );
}

async function refreshPluginRankSnapshots(client: PoolClient) {
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

async function upsertFindingCode(client: PoolClient, finding: NormalizedFinding) {
  const family = inferFindingFamily(finding.code);
  const title = humanizeCode(finding.code);
  const severityWeight = familyWeights[family];
  const editorial = getIssueEditorial({
    code: finding.code,
    title,
    family,
    weight: weightLabel(severityWeight),
  });

  await client.query(
    `
    insert into finding_codes (
      code, family, title, severity_weight, explanation, fix_guidance, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, now())
    on conflict (code) do update set
      family = excluded.family,
      title = excluded.title,
      severity_weight = excluded.severity_weight,
      updated_at = now()
    `,
    [
      finding.code,
      family,
      title,
      severityWeight,
      editorial.summary,
      editorial.fixSummary,
    ],
  );
}

async function replacePluginTags(
  client: PoolClient,
  pluginId: number,
  tags: Array<{ slug: string; name: string }>,
) {
  const normalizedTags = dedupeTags(tags);

  await client.query("delete from plugin_tags where plugin_id = $1", [pluginId]);

  for (const tag of normalizedTags) {
    const result = await client.query<{ id: number }>(
      `
      insert into tags (slug, name, updated_at)
      values ($1, $2, now())
      on conflict (slug) do update set
        name = excluded.name,
        updated_at = now()
      returning id
      `,
      [tag.slug, tag.name],
    );
    const tagId = result.rows[0]?.id;

    if (!tagId) {
      continue;
    }

    await client.query(
      `
      insert into plugin_tags (plugin_id, tag_id)
      values ($1, $2)
      on conflict do nothing
      `,
      [pluginId, tagId],
    );
  }
}

function pluginListSelectSql(extraColumn?: string) {
  return `
      select
        p.id,
        p.slug,
        p.name,
        p.short_description,
        p.icon_url,
        p.banner_url,
        p.author,
        p.author_url,
        p.homepage_url,
        p.requires_wp,
        p.tested_wp,
        p.requires_php,
        p.rating,
        p.rating_count,
        p.support_threads,
        p.support_threads_resolved,
        p.current_version,
        p.active_installs,
        p.downloads,
        p.last_updated_at,
        p.wporg_added_at,
        pcs.audit_run_id,
        pcs.scanned_at,
        coalesce(pcs.score, 0) as score,
        coalesce(pcs.previous_score, pcs.score, 0) as previous_score,
        coalesce(pcs.security_score, 0) as security_score,
        coalesce(pcs.repo_score, 0) as repo_score,
        coalesce(pcs.performance_score, 0) as performance_score,
        coalesce(pcs.maintainability_score, 0) as maintainability_score,
        coalesce(pcs.total_findings, 0) as total_findings,
        coalesce(pcs.error_count, 0) as error_count,
        coalesce(pcs.warning_count, 0) as warning_count,
        coalesce(pcs.top_issue_title, 'No open findings') as top_issue,
        coalesce(plugin_tags.tags, '[]'::jsonb) as tags
        ${extraColumn ? `, ${extraColumn}` : ""}
  `;
}

function pluginTagsSelectSql() {
  return `
      left join lateral (
        select jsonb_agg(
          jsonb_build_object('slug', t.slug, 'name', t.name)
          order by t.name asc
        ) as tags
        from plugin_tags pt
        join tags t on t.id = pt.tag_id
        where pt.plugin_id = p.id
      ) plugin_tags on true
  `;
}

function toPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    items,
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextCursor: page < totalPages ? `page:${page + 1}` : undefined,
  };
}

function rankSnapshotKeyForSort(sort: ListPluginsOptions["sort"]) {
  return {
    score_desc: "best",
    score_asc: "worst",
    downloads_desc: "most-downloaded",
    installs_desc: "most-installed",
    scanned_desc: "recently-scanned",
    issues_desc: "most-issues",
    delta_desc: "most-improved",
    updated_desc: undefined,
    relevance_desc: undefined,
  }[sort];
}

function pluginListOrderBy(
  sort: ListPluginsOptions["sort"],
  rawSearchQuery: string | null,
  values: unknown[],
) {
  if (sort === "relevance_desc" && rawSearchQuery) {
    const escapedQuery = escapeLikePattern(rawSearchQuery);
    const exactParam = values.push(rawSearchQuery);
    const prefixParam = values.push(`${escapedQuery}%`);
    const containsParam = values.push(`%${escapedQuery}%`);

    return `
      case
        when lower(p.name) = lower($${exactParam}) then 0
        when lower(p.slug) = lower($${exactParam}) then 1
        when p.name ilike $${prefixParam} escape '\\' then 2
        when p.slug ilike $${prefixParam} escape '\\' then 3
        when exists (
          select 1
          from plugin_tags relevance_exact_pt
          join tags relevance_exact_t on relevance_exact_t.id = relevance_exact_pt.tag_id
          where relevance_exact_pt.plugin_id = p.id
            and (
              lower(relevance_exact_t.name) = lower($${exactParam})
              or lower(relevance_exact_t.slug) = lower($${exactParam})
            )
        ) then 4
        when exists (
          select 1
          from plugin_tags relevance_prefix_pt
          join tags relevance_prefix_t on relevance_prefix_t.id = relevance_prefix_pt.tag_id
          where relevance_prefix_pt.plugin_id = p.id
            and (
              relevance_prefix_t.name ilike $${prefixParam} escape '\\'
              or relevance_prefix_t.slug ilike $${prefixParam} escape '\\'
            )
        ) then 5
        when p.name ilike $${containsParam} escape '\\' then 6
        when p.slug ilike $${containsParam} escape '\\' then 7
        when p.author ilike $${prefixParam} escape '\\' then 8
        when exists (
          select 1
          from plugin_tags relevance_contains_pt
          join tags relevance_contains_t on relevance_contains_t.id = relevance_contains_pt.tag_id
          where relevance_contains_pt.plugin_id = p.id
            and (
              relevance_contains_t.name ilike $${containsParam} escape '\\'
              or relevance_contains_t.slug ilike $${containsParam} escape '\\'
            )
        ) then 9
        when p.short_description ilike $${containsParam} escape '\\' then 10
        else 11
      end asc,
      coalesce(p.active_installs, 0) desc,
      coalesce(p.downloads, 0) desc,
      coalesce(p.rating_count, 0) desc,
      coalesce(p.rating, 0) desc,
      coalesce(pcs.score, 0) desc,
      p.slug asc
    `;
  }

  return {
    score_desc: "coalesce(pcs.score, 0) desc, p.slug asc",
    score_asc: "coalesce(pcs.score, 0) asc, p.slug asc",
    downloads_desc: "coalesce(p.downloads, 0) desc, p.slug asc",
    installs_desc: "coalesce(p.active_installs, 0) desc, p.slug asc",
    updated_desc: "p.last_updated_at desc nulls last, p.slug asc",
    scanned_desc: "pcs.scanned_at desc nulls last, p.slug asc",
    issues_desc: "coalesce(pcs.total_findings, 0) desc, p.slug asc",
    delta_desc: "(coalesce(pcs.score, 0) - coalesce(pcs.previous_score, pcs.score, 0)) desc, p.slug asc",
    relevance_desc: "coalesce(p.active_installs, 0) desc, p.slug asc",
  }[sort];
}

function rowToPluginSummary(row: Record<string, unknown>): PluginSummary {
  const score = Number(row.score ?? 0);
  return {
    slug: String(row.slug),
    name: String(row.name),
    shortDescription: optionalString(row.short_description),
    iconUrl: optionalString(row.icon_url),
    bannerUrl: optionalString(row.banner_url),
    author: optionalString(row.author),
    authorUrl: optionalString(row.author_url),
    homepageUrl: optionalString(row.homepage_url),
    requiresWp: optionalString(row.requires_wp),
    testedWp: optionalString(row.tested_wp),
    requiresPhp: optionalString(row.requires_php),
    rating: optionalNumber(row.rating),
    ratingCount: optionalNumber(row.rating_count),
    supportThreads: optionalNumber(row.support_threads),
    supportThreadsResolved: optionalNumber(row.support_threads_resolved),
    version: String(row.current_version ?? "unknown"),
    score,
    previousScore: Number(row.previous_score ?? score),
    activeInstalls: formatCompact(Number(row.active_installs ?? 0)),
    downloads: formatCompact(Number(row.downloads ?? 0)),
    lastUpdated: row.last_updated_at ? new Date(String(row.last_updated_at)).toISOString().slice(0, 10) : "unknown",
    addedAt: row.wporg_added_at ? new Date(String(row.wporg_added_at)).toISOString().slice(0, 10) : undefined,
    scannedAt: row.scanned_at ? new Date(String(row.scanned_at)).toISOString() : undefined,
    findings: Number(row.total_findings ?? 0),
    errors: Number(row.error_count ?? 0),
    warnings: Number(row.warning_count ?? 0),
    topIssue: String(row.top_issue ?? "No open findings"),
    band: score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "watch" : "risk",
    audited: optionalNumber(row.audit_run_id) !== undefined,
    tags: rowToPluginTags(row.tags),
  };
}

function rowToPluginScoreHistoryPoint(row: Record<string, unknown>) {
  return {
    auditRunId: Number(row.audit_run_id),
    scannedAt: row.scanned_at ? new Date(String(row.scanned_at)).toISOString() : new Date().toISOString(),
    pluginVersion: String(row.plugin_version),
    pluginCheckVersion: String(row.plugin_check_version),
    scoringModelVersion: String(row.scoring_model_version),
    score: Number(row.score ?? 0),
    scores: rowToScoreBreakdown(row),
    findings: Number(row.total_findings ?? 0),
    errors: Number(row.error_count ?? 0),
    warnings: Number(row.warning_count ?? 0),
    durationMs: optionalNumber(row.duration_ms),
  };
}

function rowToApiStats(row: Record<string, unknown>): ApiStats {
  return {
    indexedPlugins: Number(row.indexed_plugins ?? 0),
    auditedPlugins: Number(row.audited_plugins ?? 0),
    completedScans: Number(row.completed_scans ?? 0),
    queuedJobs: Number(row.queued_jobs ?? 0),
    runningJobs: Number(row.running_jobs ?? 0),
    failedJobs: Number(row.failed_jobs ?? 0),
    issueCodes: Number(row.issue_codes ?? 0),
    recentSearches: Number(row.recent_searches ?? 0),
  };
}

function rowToOperationsVersionCount(row: Record<string, unknown>): OperationsVersionCount {
  return {
    version: String(row.version ?? "unknown"),
    count: Number(row.count ?? 0),
  };
}

function rowToOperationsRunningJob(row: Record<string, unknown>): OperationsRunningJob {
  return {
    plugin: String(row.plugin),
    name: String(row.name),
    version: String(row.version),
    reason: String(row.reason),
    attempts: Number(row.attempts ?? 0),
    runtimeMs: Number(row.runtime_ms ?? 0),
    updatedAt: optionalIsoDate(row.updated_at) ?? new Date().toISOString(),
  };
}

function rowToOperationsRecentScan(row: Record<string, unknown>): OperationsRecentScan {
  return {
    plugin: String(row.plugin),
    name: String(row.name),
    version: String(row.version),
    completedAt: optionalIsoDate(row.completed_at) ?? new Date().toISOString(),
    durationMs: optionalRoundedNumber(row.duration_ms),
    score: optionalRoundedNumber(row.score),
    findings: optionalRoundedNumber(row.total_findings),
  };
}

function rowToOperationsRecentFailure(row: Record<string, unknown>): OperationsRecentFailure {
  const state = String(row.state) === "timeout" ? "timeout" : "failed";

  return {
    plugin: String(row.plugin),
    name: String(row.name),
    version: String(row.version),
    state,
    attempts: optionalRoundedNumber(row.attempts),
    lastError: optionalString(row.last_error),
    updatedAt: optionalIsoDate(row.updated_at),
    completedAt: optionalIsoDate(row.completed_at),
    durationMs: optionalRoundedNumber(row.duration_ms),
  };
}

function rowToAuditFindingsRetentionSummary(
  row: Record<string, unknown>,
): AuditFindingsRetentionSummary {
  return {
    policy: "latest_scan_findings_per_plugin",
    dryRun: true,
    totalFindingRows: Number(row.total_finding_rows ?? 0),
    currentFindingRows: Number(row.current_finding_rows ?? 0),
    staleFindingRows: Number(row.stale_finding_rows ?? 0),
    currentAuditRuns: Number(row.current_audit_runs ?? 0),
    staleAuditRuns: Number(row.stale_audit_runs ?? 0),
    pluginsWithStaleFindings: Number(row.plugins_with_stale_findings ?? 0),
    auditFindingsTableBytes: Number(row.audit_findings_table_bytes ?? 0),
    estimatedReusableBytes: Number(row.estimated_reusable_bytes ?? 0),
  };
}

function rowToAuthorSummary(row: Record<string, unknown>): AuthorSummary {
  const auditedPluginCount = Number(row.audited_plugin_count ?? 0);
  const averageScore = optionalNumber(row.average_score);

  return {
    name: String(row.name),
    pluginCount: Number(row.plugin_count ?? 0),
    auditedPluginCount,
    activeInstalls: Number(row.active_installs ?? 0),
    downloads: Number(row.downloads ?? 0),
    averageScore: auditedPluginCount > 0 ? averageScore : undefined,
    totalFindings: Number(row.total_findings ?? 0),
    totalErrors: Number(row.total_errors ?? 0),
    totalWarnings: Number(row.total_warnings ?? 0),
  };
}

function rowsToAuthorDetail(authorName: string, rows: Record<string, unknown>[]): AuthorDetail {
  const plugins = rows.map(rowToPluginSummary);
  const auditedRows = rows.filter((row) => optionalNumber(row.audit_run_id) !== undefined);
  const scoreValues = auditedRows
    .map((row) => optionalNumber(row.score))
    .filter((score): score is number => score !== undefined);
  const averageScore = scoreValues.length
    ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
    : undefined;

  return {
    name: optionalString(rows[0]?.author) ?? authorName,
    pluginCount: rows.length,
    auditedPluginCount: auditedRows.length,
    activeInstalls: sumRows(rows, "active_installs"),
    downloads: sumRows(rows, "downloads"),
    averageScore,
    totalFindings: sumRows(rows, "total_findings"),
    totalErrors: sumRows(rows, "error_count"),
    totalWarnings: sumRows(rows, "warning_count"),
    plugins,
  };
}

function rowToPluginSearchSummary(row: Record<string, unknown>): PluginSearchSummary {
  return {
    ...rowToPluginSummary(row),
    searchedAt: row.searched_at ? new Date(String(row.searched_at)).toISOString() : new Date().toISOString(),
    searchCount: Number(row.search_count ?? 0),
  };
}

function rowToScoreBreakdown(row: Record<string, unknown>) {
  return {
    security: Number(row.security_score ?? 0),
    repo: Number(row.repo_score ?? 0),
    performance: Number(row.performance_score ?? 0),
    maintainability: Number(row.maintainability_score ?? 0),
  };
}

function rowToAuditRunSummary(row: Record<string, unknown>): AuditRunSummary {
  return {
    id: Number(row.id),
    status: String(row.status) as AuditRunSummary["status"],
    pluginVersion: String(row.plugin_version),
    pluginCheckVersion: String(row.plugin_check_version),
    scoringModelVersion: String(row.scoring_model_version),
    durationMs: optionalNumber(row.duration_ms),
    exitCode: optionalNumber(row.exit_code),
    timedOut: Boolean(row.timed_out),
    sourceSha256: optionalString(row.source_sha256),
    rawReportObjectKey: optionalString(row.raw_report_object_key),
    rawReportStored: Boolean(row.raw_report_stored),
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : undefined,
    stderrPreview: optionalString(row.stderr_preview),
  };
}

function rowToFindingCodeCount(row: Record<string, unknown>): FindingCodeCount {
  return {
    code: String(row.code),
    title: String(row.title),
    family: String(row.family),
    severity: String(row.severity) === "error" ? "error" : "warning",
    count: Number(row.count ?? 0),
    sampleMessage: String(row.sample_message ?? ""),
    docsUrl: optionalString(row.docs_url),
  };
}

function rowToQueueJob(row: Record<string, unknown>): QueueJob {
  const status = String(row.status);
  return {
    plugin: String(row.plugin),
    version: String(row.version),
    state:
      status === "running" || status === "queued" || status === "complete"
        ? status
        : "failed",
    reason: String(row.reason),
    runtime: formatRuntime(optionalNumber(row.runtime_ms)),
  };
}

function rowToTrackedPluginSummary(row: Record<string, unknown>): TrackedPluginSummary {
  return {
    slug: String(row.slug),
    version: optionalString(row.current_version),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : undefined,
  };
}

function rowToTagSummary(row: Record<string, unknown>): TagSummary {
  const auditedPluginCount = Number(row.audited_plugin_count ?? 0);
  const averageScore = optionalNumber(row.average_score);

  return {
    slug: String(row.slug),
    name: String(row.name),
    pluginCount: Number(row.plugin_count ?? 0),
    auditedPluginCount,
    activeInstalls: Number(row.active_installs ?? 0),
    averageScore: auditedPluginCount > 0 ? averageScore : undefined,
  };
}

function rowToPluginTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tag) => {
      if (!tag || typeof tag !== "object") {
        return null;
      }

      const record = tag as Record<string, unknown>;
      const slug = optionalString(record.slug);
      const name = optionalString(record.name);

      return slug && name ? { slug, name } : null;
    })
    .filter((tag): tag is { slug: string; name: string } => tag !== null);
}

function dedupeTags(tags: Array<{ slug: string; name: string }>) {
  const bySlug = new Map<string, { slug: string; name: string }>();

  for (const tag of tags) {
    const slug = normalizeTagSlug(tag.slug);
    const name = tag.name.trim().replace(/\s+/g, " ");

    if (!slug || !name) {
      continue;
    }

    bySlug.set(slug, { slug, name });
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeTagSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function optionalRoundedNumber(value: unknown) {
  const number = optionalNumber(value);
  return number === undefined ? undefined : Math.round(number);
}

function optionalIsoDate(value: unknown) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function sumRows(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rowToIssueSummary(row: Record<string, unknown>): IssueSummary {
  return enrichIssueSummary({
    code: String(row.code),
    title: String(row.title),
    family: String(row.family),
    weight: weightLabel(Number(row.severity_weight ?? 0)),
    affectedPlugins: Number(row.affected_plugins ?? 0),
    explanation: String(row.explanation),
    fix: String(row.fix_guidance),
  });
}

function weightLabel(weight: number): IssueSummary["weight"] {
  if (weight >= 7) return "critical";
  if (weight >= 4) return "high";
  if (weight >= 1) return "medium";
  return "low";
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k+`;
  return String(value);
}

function formatRuntime(runtimeMs?: number) {
  if (runtimeMs === undefined) {
    return "-";
  }

  const seconds = Math.max(0, Math.round(runtimeMs / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 48) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function humanizeCode(code: string) {
  const last = code.split(".").at(-1) ?? code;
  return last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
