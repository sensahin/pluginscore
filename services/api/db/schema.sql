create table if not exists plugins (
  id bigserial primary key,
  slug text not null unique,
  name text not null,
  short_description text,
  icon_url text,
  banner_url text,
  author text,
  author_url text,
  homepage_url text,
  requires_wp text,
  tested_wp text,
  requires_php text,
  rating integer,
  rating_count integer,
  support_threads integer,
  support_threads_resolved integer,
  current_version text,
  active_installs integer,
  downloads bigint,
  last_updated_at timestamptz,
  wporg_added_at timestamptz,
  download_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists plugins add column if not exists short_description text;
alter table if exists plugins drop column if exists description;
alter table if exists plugins add column if not exists icon_url text;
alter table if exists plugins add column if not exists banner_url text;
alter table if exists plugins add column if not exists author text;
alter table if exists plugins add column if not exists author_url text;
alter table if exists plugins add column if not exists homepage_url text;
alter table if exists plugins add column if not exists requires_wp text;
alter table if exists plugins add column if not exists tested_wp text;
alter table if exists plugins add column if not exists requires_php text;
alter table if exists plugins add column if not exists rating integer;
alter table if exists plugins add column if not exists rating_count integer;
alter table if exists plugins add column if not exists support_threads integer;
alter table if exists plugins add column if not exists support_threads_resolved integer;
alter table if exists plugins add column if not exists wporg_added_at timestamptz;

create index if not exists plugins_author_lower_idx
  on plugins (lower(author))
  where author is not null and btrim(author) <> '';
create index if not exists plugins_author_profile_slug_idx
  on plugins ((
    case
      when author_url ~* '^https?://profiles\.wordpress\.org/[^/?#]+/?'
      then lower(regexp_replace(
        author_url,
        '^https?://profiles\.wordpress\.org/([^/?#]+)/?.*$',
        '\1',
        'i'
      ))
      else null
    end
  ))
  where author_url is not null;
create index if not exists plugins_author_key_idx
  on plugins ((
    coalesce(
      case
        when author_url ~* '^https?://profiles\.wordpress\.org/[^/?#]+/?'
        then lower(regexp_replace(
          author_url,
          '^https?://profiles\.wordpress\.org/([^/?#]+)/?.*$',
          '\1',
          'i'
        ))
        else null
      end,
      lower(author)
    )
  ))
  where author is not null and btrim(author) <> '';

create table if not exists plugin_search_events (
  id bigserial primary key,
  plugin_id bigint references plugins(id) on delete cascade,
  query text not null,
  created_at timestamptz not null default now()
);

create index if not exists plugin_search_events_created_idx
  on plugin_search_events(created_at desc);
create index if not exists plugin_search_events_plugin_created_idx
  on plugin_search_events(plugin_id, created_at desc);

create table if not exists comparison_daily_stats (
  comparison_key text not null,
  plugin_slugs text[] not null,
  plugin_count smallint not null check (plugin_count between 2 and 4),
  comparison_date date not null default current_date,
  compare_count integer not null default 1 check (compare_count > 0),
  first_compared_at timestamptz not null default now(),
  last_compared_at timestamptz not null default now(),
  primary key (comparison_key, comparison_date),
  check (plugin_count = cardinality(plugin_slugs))
);

create index if not exists comparison_daily_stats_popular_idx
  on comparison_daily_stats(comparison_date desc, plugin_count, compare_count desc);

create table if not exists tags (
  id bigserial primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plugin_tags (
  plugin_id bigint not null references plugins(id) on delete cascade,
  tag_id bigint not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plugin_id, tag_id)
);

create index if not exists plugin_tags_tag_idx on plugin_tags(tag_id, plugin_id);
create index if not exists plugin_tags_plugin_idx on plugin_tags(plugin_id, tag_id);

create table if not exists finding_codes (
  code text primary key,
  family text not null,
  title text not null,
  severity_weight numeric(8, 4) not null,
  official_docs_url text,
  explanation text not null,
  fix_guidance text not null,
  first_seen_plugin_check_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finding_code_stats (
  code text primary key references finding_codes(code) on delete cascade,
  affected_plugins integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into finding_code_stats (code, affected_plugins, updated_at)
select code, 0, now()
from finding_codes
on conflict (code) do nothing;

create table if not exists audit_runs (
  id bigserial primary key,
  plugin_id bigint not null references plugins(id) on delete cascade,
  plugin_version text not null,
  plugin_check_version text not null,
  scoring_model_version text not null,
  source_download_url text not null,
  source_sha256 text,
  status text not null check (status in ('queued', 'running', 'complete', 'failed', 'timeout')),
  exit_code integer,
  timed_out boolean not null default false,
  duration_ms integer,
  stderr text,
  trigger_reason text not null default 'unknown',
  raw_report_object_key text,
  raw_report_json jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table if exists audit_runs add column if not exists raw_report_json jsonb;
alter table if exists audit_runs add column if not exists trigger_reason text not null default 'unknown';

create table if not exists plugin_reports (
  id bigserial primary key,
  plugin_id bigint references plugins(id) on delete set null,
  plugin_slug text not null,
  plugin_version text not null,
  audit_run_id bigint references audit_runs(id) on delete set null,
  report_type text not null check (
    report_type in (
      'incorrect_metadata',
      'score_looks_wrong',
      'false_positive_issue',
      'missing_issue',
      'plugin_updated',
      'other'
    )
  ),
  message text not null,
  contact_email text,
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved', 'spam')),
  admin_notes text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plugin_reports_created_idx
  on plugin_reports(created_at desc, id desc);
create index if not exists plugin_reports_status_created_idx
  on plugin_reports(status, created_at desc, id desc);
create index if not exists plugin_reports_plugin_created_idx
  on plugin_reports(plugin_slug, created_at desc, id desc);
create index if not exists plugin_reports_type_created_idx
  on plugin_reports(report_type, created_at desc, id desc);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists external_connection_analyses (
  plugin_id bigint primary key references plugins(id) on delete cascade,
  audit_run_id bigint references audit_runs(id) on delete set null,
  plugin_version text not null,
  analysis_version text not null,
  status text not null check (status in ('complete', 'skipped', 'failed', 'timeout')),
  duration_ms integer,
  error_message text,
  files_scanned integer not null default 0,
  bytes_scanned bigint not null default 0,
  domain_count integer not null default 0,
  outbound_call_count integer not null default 0,
  external_asset_count integer not null default 0,
  incoming_endpoint_count integer not null default 0,
  high_confidence_count integer not null default 0,
  medium_confidence_count integer not null default 0,
  low_confidence_count integer not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table external_connection_analyses
  add column if not exists domain_refs_indexed_at timestamptz;

create index if not exists external_connection_analyses_status_idx
  on external_connection_analyses(status, analyzed_at desc);
create index if not exists external_connection_analyses_analyzed_idx
  on external_connection_analyses(analyzed_at desc);

create table if not exists external_connection_domain_refs (
  plugin_id bigint not null references plugins(id) on delete cascade,
  domain text not null,
  plugin_version text not null,
  analyzed_at timestamptz not null,
  reference_count integer not null default 0,
  outbound_reference_count integer not null default 0,
  external_asset_reference_count integer not null default 0,
  reference_types text[] not null default '{}'::text[],
  confidence_rank smallint not null default 3 check (confidence_rank between 1 and 3),
  sample_urls jsonb not null default '[]'::jsonb,
  primary key (plugin_id, domain)
);

create index if not exists external_connection_domain_refs_domain_idx
  on external_connection_domain_refs(domain, plugin_id);
create index if not exists external_connection_domain_refs_domain_seen_idx
  on external_connection_domain_refs(domain, analyzed_at desc);

with pending_analyses as materialized (
  select plugin_id, plugin_version, analyzed_at, summary_json
  from external_connection_analyses
  where status = 'complete'
    and domain_refs_indexed_at is null
),
finding_rows as materialized (
  select
    pending.plugin_id,
    pending.plugin_version,
    pending.analyzed_at,
    regexp_replace(lower(finding_item->>'domain'), '^www\.', '') as domain,
    finding_item->>'type' as reference_type,
    case finding_item->>'confidence'
      when 'high' then 1
      when 'medium' then 2
      else 3
    end as confidence_rank
  from pending_analyses pending
  cross join lateral jsonb_array_elements(
    coalesce(pending.summary_json->'findings', '[]'::jsonb)
  ) finding_item
  where finding_item ? 'domain'
    and coalesce(finding_item->>'domain', '') <> ''
    and finding_item->>'type' in ('outbound_http', 'external_asset')
),
domain_samples as materialized (
  select distinct on (pending.plugin_id, domain)
    pending.plugin_id,
    domain,
    coalesce(domain_item->'sampleUrls', '[]'::jsonb) as sample_urls
  from pending_analyses pending
  cross join lateral jsonb_array_elements(
    coalesce(pending.summary_json->'domains', '[]'::jsonb)
  ) domain_item
  cross join lateral (
    values (regexp_replace(lower(domain_item->>'domain'), '^www\.', ''))
  ) normalized(domain)
  where domain_item ? 'domain'
  order by pending.plugin_id, domain
)
insert into external_connection_domain_refs (
  plugin_id,
  domain,
  plugin_version,
  analyzed_at,
  reference_count,
  outbound_reference_count,
  external_asset_reference_count,
  reference_types,
  confidence_rank,
  sample_urls
)
select
  findings.plugin_id,
  findings.domain,
  findings.plugin_version,
  findings.analyzed_at,
  count(*)::integer,
  count(*) filter (where findings.reference_type = 'outbound_http')::integer,
  count(*) filter (where findings.reference_type = 'external_asset')::integer,
  array_agg(distinct findings.reference_type order by findings.reference_type),
  min(findings.confidence_rank)::smallint,
  coalesce(samples.sample_urls, '[]'::jsonb)
from finding_rows findings
left join domain_samples samples
  on samples.plugin_id = findings.plugin_id
 and samples.domain = findings.domain
where (
  findings.domain ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
  or findings.domain ~ '^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+\.[a-z]{2,}$'
)
group by
  findings.plugin_id,
  findings.domain,
  findings.plugin_version,
  findings.analyzed_at,
  samples.sample_urls
on conflict (plugin_id, domain) do update set
  plugin_version = excluded.plugin_version,
  analyzed_at = excluded.analyzed_at,
  reference_count = excluded.reference_count,
  outbound_reference_count = excluded.outbound_reference_count,
  external_asset_reference_count = excluded.external_asset_reference_count,
  reference_types = excluded.reference_types,
  confidence_rank = excluded.confidence_rank,
  sample_urls = excluded.sample_urls;

update external_connection_analyses
set domain_refs_indexed_at = now()
where domain_refs_indexed_at is null;

create table if not exists audit_findings (
  id bigserial primary key,
  audit_run_id bigint not null references audit_runs(id) on delete cascade,
  code text not null references finding_codes(code),
  type text not null,
  severity text not null,
  file_path text,
  line integer,
  column_number integer,
  message text not null,
  docs_url text,
  created_at timestamptz not null default now()
);

create index if not exists audit_findings_code_idx on audit_findings(code);
create index if not exists audit_findings_run_code_idx on audit_findings(audit_run_id, code);
create index if not exists audit_runs_plugin_version_complete_idx
  on audit_runs(plugin_id, plugin_version, plugin_check_version, scoring_model_version)
  where status = 'complete';
create index if not exists audit_runs_plugin_version_failure_idx
  on audit_runs(plugin_id, plugin_version, plugin_check_version, scoring_model_version, status, completed_at desc)
  where status in ('failed', 'timeout');

create table if not exists score_snapshots (
  id bigserial primary key,
  audit_run_id bigint not null unique references audit_runs(id) on delete cascade,
  plugin_id bigint not null references plugins(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  security_score integer not null check (security_score >= 0 and security_score <= 100),
  repo_score integer not null check (repo_score >= 0 and repo_score <= 100),
  performance_score integer not null check (performance_score >= 0 and performance_score <= 100),
  maintainability_score integer not null check (maintainability_score >= 0 and maintainability_score <= 100),
  total_findings integer not null,
  error_count integer not null,
  warning_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists score_snapshots_plugin_created_idx on score_snapshots(plugin_id, created_at desc);
create index if not exists score_snapshots_score_idx on score_snapshots(score desc);

create table if not exists plugin_current_scores (
  plugin_id bigint primary key references plugins(id) on delete cascade,
  audit_run_id bigint not null unique references audit_runs(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  previous_score integer not null check (previous_score >= 0 and previous_score <= 100),
  security_score integer not null check (security_score >= 0 and security_score <= 100),
  repo_score integer not null check (repo_score >= 0 and repo_score <= 100),
  performance_score integer not null check (performance_score >= 0 and performance_score <= 100),
  maintainability_score integer not null check (maintainability_score >= 0 and maintainability_score <= 100),
  total_findings integer not null,
  error_count integer not null,
  warning_count integer not null,
  top_issue_title text,
  scanned_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table if exists plugin_current_scores add column if not exists previous_score integer not null default 0;
alter table if exists plugin_current_scores add column if not exists top_issue_title text;
alter table if exists plugin_current_scores add column if not exists scanned_at timestamptz not null default now();
alter table if exists plugin_current_scores add column if not exists updated_at timestamptz not null default now();

create index if not exists plugin_current_scores_score_idx on plugin_current_scores(score desc, plugin_id);
create index if not exists plugin_current_scores_scanned_idx on plugin_current_scores(scanned_at desc, plugin_id);
create index if not exists plugin_current_scores_findings_idx on plugin_current_scores(total_findings desc, plugin_id);

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
  updated_at = now();

create table if not exists plugin_rank_snapshots (
  ranking_key text not null,
  rank integer not null,
  plugin_id bigint not null references plugins(id) on delete cascade,
  sort_value numeric not null,
  computed_at timestamptz not null default now(),
  primary key (ranking_key, plugin_id)
);

alter table if exists plugin_rank_snapshots
  drop constraint if exists plugin_rank_snapshots_ranking_key_rank_key;

create index if not exists plugin_rank_snapshots_rank_idx on plugin_rank_snapshots(ranking_key, rank);

delete from plugin_rank_snapshots;

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
    'new-popular'::text as ranking_key,
    row_number() over (
      order by
        coalesce(p.active_installs, 0) desc,
        p.wporg_added_at desc nulls last,
        coalesce(p.downloads, 0) desc,
        coalesce(p.rating, 0) desc,
        p.slug asc
    )::integer as rank,
    p.id as plugin_id,
    coalesce(p.active_installs, 0)::numeric as sort_value
  from plugins p
  where p.wporg_added_at is not null
    and p.wporg_added_at >= current_date - interval '24 months'
    and coalesce(p.active_installs, 0) >= 1000

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
on conflict (ranking_key, plugin_id) do update set
  rank = excluded.rank,
  sort_value = excluded.sort_value,
  computed_at = excluded.computed_at;

create table if not exists scan_jobs (
  id bigserial primary key,
  plugin_id bigint not null references plugins(id) on delete cascade,
  target_version text not null,
  reason text not null,
  status text not null check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  priority integer not null default 100,
  attempts integer not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scan_jobs_queue_idx on scan_jobs(status, priority asc, run_after asc);
