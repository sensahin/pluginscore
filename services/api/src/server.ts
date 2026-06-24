import cors from "@fastify/cors";
import { SCORING_MODEL_VERSION } from "@pluginscore/scoring";
import { fetchPluginBySlug, normalizeWordPressPluginSlug } from "@pluginscore/wporg";
import { createHmac, timingSafeEqual } from "node:crypto";
import fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiConfig } from "./config.js";
import type { PluginScoreStore } from "./store/types.js";

const listPluginsQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  perPage: z.coerce.number().int().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  sort: z
    .enum([
      "score_desc",
      "score_asc",
      "downloads_desc",
      "installs_desc",
      "updated_desc",
      "scanned_desc",
      "issues_desc",
      "delta_desc",
      "new_popular_desc",
      "relevance_desc",
    ])
    .default("score_desc"),
  audited: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
  q: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  author: z.string().trim().min(1).max(160).optional(),
  issueCode: z.string().trim().min(1).max(260).optional(),
  issueFamily: z.string().trim().min(1).max(120).optional(),
});

const listQueueQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

const listTrackedPluginsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(10000).default(5000),
});

const pluginHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const reportTypeSchema = z.enum([
  "incorrect_metadata",
  "score_looks_wrong",
  "false_positive_issue",
  "missing_issue",
  "plugin_updated",
  "other",
]);

const reportStatusSchema = z.enum(["new", "triaged", "resolved", "spam"]);

const listPluginReportsQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: reportStatusSchema.optional(),
  reportType: reportTypeSchema.optional(),
  pluginSlug: z.string().trim().min(1).max(200).optional(),
  hasContactEmail: z.enum(["true", "false"]).optional().transform((value) => {
    if (value === undefined) return undefined;
    return value === "true";
  }),
  createdFrom: z.string().trim().min(1).max(32).optional(),
  createdTo: z.string().trim().min(1).max(32).optional(),
});

const listRecentSearchesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(4),
});

const listAuthorsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const listTagsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  minimumPlugins: z.coerce.number().int().min(1).max(100).default(1),
});

const listExternalDomainsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  minimumPlugins: z.coerce.number().int().min(1).max(100).default(1),
});

const externalDomainDetailQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  scope: z.enum(["exact", "family"]).default("exact"),
});

const tagDetailQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  sort: z
    .enum([
      "score_desc",
      "score_asc",
      "installs_desc",
      "downloads_desc",
      "new_popular_desc",
      "issues_desc",
      "delta_desc",
      "scanned_desc",
    ])
    .default("score_desc"),
});

const recordSearchBody = z.object({
  slug: z.string().trim().min(1).max(200),
});

const submitPluginBody = z.object({
  input: z.string().trim().min(1).max(260).optional(),
  slug: z.string().trim().min(1).max(260).optional(),
});

const contactEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().email().max(254).optional(),
);

const submitPluginReportBody = z.object({
  pluginVersion: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().max(120).optional(),
  ),
  auditRunId: z.coerce.number().int().positive().optional(),
  reportType: reportTypeSchema,
  message: z.string().trim().min(10).max(2000),
  contactEmail,
  website: z.string().max(200).optional(),
});

const updatePluginReportBody = z.object({
  status: reportStatusSchema.optional(),
  adminNotes: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : undefined),
    z.string().max(2000).optional(),
  ),
});

const externalConnectionModeSchema = z.enum(["off", "new_scans", "sample"]);

const updateExternalConnectionSettingsBody = z.object({
  mode: externalConnectionModeSchema,
  sampleRemaining: z.coerce.number().int().min(0).max(1000).optional(),
});

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : undefined),
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : undefined),
  z.string().url().optional(),
);

const enqueueJobBody = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  shortDescription: optionalText,
  iconUrl: optionalUrl,
  bannerUrl: optionalUrl,
  author: optionalText,
  authorUrl: optionalUrl,
  homepageUrl: optionalUrl,
  requiresWp: optionalText,
  testedWp: optionalText,
  requiresPhp: optionalText,
  rating: z.number().int().min(0).max(100).optional(),
  ratingCount: z.number().int().nonnegative().optional(),
  supportThreads: z.number().int().nonnegative().optional(),
  supportThreadsResolved: z.number().int().nonnegative().optional(),
  tags: z.array(z.object({
    slug: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
  })).max(20).optional(),
  version: z.string().min(1),
  activeInstalls: z.number().int().nonnegative().optional(),
  downloaded: z.number().int().nonnegative().optional(),
  lastUpdated: optionalText,
  addedAt: optionalText,
  downloadLink: z.string().url(),
  reason: z.string().min(1).default("manual"),
  priority: z.number().int().min(0).max(1000).optional(),
  pluginCheckVersion: z.string().min(1).optional(),
  scoringModelVersion: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

const findingSchema = z.object({
  code: z.string().min(1),
  type: z.string().min(1),
  severity: z.enum(["error", "warning"]),
  filePath: z.string().optional(),
  line: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional(),
  message: z.string().min(1),
  docsUrl: z.string().url().optional(),
});

const externalConnectionTypeSchema = z.enum([
  "outbound_http",
  "external_asset",
  "incoming_endpoint",
]);

const externalConnectionFindingSchema = z.object({
  type: externalConnectionTypeSchema,
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string().min(1).max(120),
  filePath: z.string().max(500).optional(),
  line: z.number().int().positive().optional(),
  url: z.string().url().max(2000).optional(),
  domain: z.string().max(255).optional(),
  endpoint: z.string().max(500).optional(),
  method: z.string().max(40).optional(),
});

const externalConnectionAnalysisSchema = z.object({
  status: z.enum(["complete", "skipped", "failed", "timeout"]),
  analysisVersion: z.string().min(1).max(80),
  pluginVersion: z.string().min(1).max(120),
  analyzedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().max(1000).optional(),
  filesScanned: z.number().int().nonnegative().max(100000),
  bytesScanned: z.number().int().nonnegative(),
  totals: z.object({
    domains: z.number().int().nonnegative().max(10000),
    outboundCalls: z.number().int().nonnegative().max(100000),
    externalAssets: z.number().int().nonnegative().max(100000),
    incomingEndpoints: z.number().int().nonnegative().max(100000),
    findings: z.number().int().nonnegative().max(100000),
    highConfidence: z.number().int().nonnegative().max(100000),
    mediumConfidence: z.number().int().nonnegative().max(100000),
    lowConfidence: z.number().int().nonnegative().max(100000),
  }),
  domains: z.array(z.object({
    domain: z.string().min(1).max(255),
    types: z.array(externalConnectionTypeSchema).max(3),
    confidence: z.enum(["high", "medium", "low"]),
    count: z.number().int().nonnegative(),
    sampleUrls: z.array(z.string().url().max(2000)).max(5),
  })).max(100),
  endpoints: z.array(z.object({
    endpoint: z.string().min(1).max(500),
    source: z.string().min(1).max(120),
    exposure: z.enum(["public", "authenticated", "unknown"]),
    count: z.number().int().nonnegative(),
    sampleFiles: z.array(z.string().max(500)).max(5),
  })).max(100),
  findings: z.array(externalConnectionFindingSchema).max(300),
});

const completeJobBody = z.object({
  pluginVersion: z.string().min(1),
  pluginCheckVersion: z.string().min(1),
  scoringModelVersion: z.string().min(1),
  sourceDownloadUrl: z.string().url(),
  sourceSha256: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
  exitCode: z.number().int(),
  rawReportObjectKey: z.string().optional(),
  rawReport: z.unknown().optional(),
  stderr: z.string().optional(),
  findings: z.array(findingSchema),
  externalConnections: externalConnectionAnalysisSchema.optional(),
});

const failJobBody = z.object({
  message: z.string().min(1),
  pluginCheckVersion: z.string().min(1).optional(),
  scoringModelVersion: z.string().min(1).optional(),
  timedOut: z.boolean().optional(),
  stderr: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export async function createServer(config: ApiConfig, store: PluginScoreStore) {
  const app = fastify({
    trustProxy: true,
    bodyLimit: config.bodyLimitBytes,
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  await app.register(cors, {
    origin: config.corsOrigin,
  });

  const requireInternalAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.internalToken) {
      return;
    }

    const token = readBearerToken(request.headers.authorization);
    if (!token || !tokensMatch(token, config.internalToken)) {
      return reply.code(401).send({ error: "internal_auth_required" });
    }
  };
  const searchRateLimiter = createFixedWindowRateLimiter({
    limit: config.searchRateLimitPerMinute,
    windowMs: 60_000,
  });
  const submissionRateLimiter = createFixedWindowRateLimiter({
    limit: config.submissionRateLimitPerMinute,
    windowMs: 60_000,
  });
  const reportRateLimiter = createFixedWindowRateLimiter({
    limit: config.reportRateLimitPerMinute,
    windowMs: 60_000,
  });

  app.get("/health", async () => store.health());

  app.get("/stats", async () => store.stats());

  app.get(
    "/maintenance/audit-findings-retention",
    { preHandler: requireInternalAuth },
    async () => store.auditFindingsRetention(),
  );

  app.get(
    "/maintenance/operations",
    { preHandler: requireInternalAuth },
    async () => store.operationsSummary(),
  );

  app.get(
    "/maintenance/external-connections",
    { preHandler: requireInternalAuth },
    async () => store.externalConnectionOperations(),
  );

  app.patch(
    "/maintenance/external-connections",
    { preHandler: requireInternalAuth },
    async (request) => {
      const body = updateExternalConnectionSettingsBody.parse(request.body);
      return store.updateExternalConnectionSettings({
        mode: body.mode,
        sampleRemaining: body.sampleRemaining,
      });
    },
  );

  app.get("/plugins", async (request) => {
    const query = listPluginsQuery.parse(request.query);
    return store.listPlugins({
      page: query.page,
      perPage: query.perPage ?? query.limit ?? 50,
      sort: query.sort,
      query: query.q,
      auditedOnly: query.audited,
      tag: query.tag,
      author: query.author,
      issueCode: query.issueCode,
      issueFamily: query.issueFamily,
    });
  });

  app.get("/plugins/:slug", async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const plugin = await store.getPlugin(slug);

    if (!plugin) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }

    return plugin;
  });

  app.get("/plugins/:slug/history", async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const query = pluginHistoryQuery.parse(request.query);
    const history = await store.getPluginHistory(slug, query);

    if (!history) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }

    return history;
  });

  app.post("/plugins/:slug/reports", async (request, reply) => {
    const { slug: rawSlug } = z.object({ slug: z.string() }).parse(request.params);
    const slug = normalizeSlug(rawSlug);

    if (!slug) {
      return reply.code(400).send({ error: "invalid_plugin_slug" });
    }

    if (!reportRateLimiter.consume(`${request.ip}:${slug}`)) {
      return reply
        .code(429)
        .header("Retry-After", "60")
        .send({ error: "rate_limited" });
    }

    const body = submitPluginReportBody.parse(request.body);

    if (body.website?.trim()) {
      return reply.code(202).send({ submitted: true });
    }

    if (isUrlHeavy(body.message)) {
      return reply.code(400).send({ error: "too_many_links" });
    }

    const report = await store.createPluginReport({
      pluginSlug: slug,
      pluginVersion: body.pluginVersion,
      auditRunId: body.auditRunId,
      reportType: body.reportType,
      message: body.message,
      contactEmail: body.contactEmail,
      ipHash: hashIp(request.ip, config.reportIpHashSecret),
      userAgent: truncateHeader(request.headers["user-agent"]),
    });

    if (!report) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }

    return reply.code(201).send({ submitted: true, reportId: report.id });
  });

  app.post("/plugins/submissions", async (request, reply) => {
    if (!submissionRateLimiter.consume(request.ip)) {
      return reply
        .code(429)
        .header("Retry-After", "60")
        .send({ error: "rate_limited" });
    }

    const body = submitPluginBody.parse(request.body);
    const input = body.input ?? body.slug ?? "";
    const slug = normalizeWordPressPluginSlug(input);

    if (!slug) {
      return reply.code(400).send({ error: "invalid_plugin_slug" });
    }

    let metadata;
    try {
      metadata = await fetchPluginBySlug(slug);
    } catch (error) {
      request.log.warn({ error, slug }, "WordPress.org plugin lookup failed");
      return reply.code(502).send({ error: "wordpress_org_unavailable" });
    }

    if (!metadata) {
      return reply.code(404).send({ error: "wordpress_plugin_not_found", slug });
    }

    const result = await store.enqueueJob({
      ...metadata,
      reason: "user submission",
      priority: 50,
      pluginCheckVersion: config.pluginCheckVersion,
      scoringModelVersion: SCORING_MODEL_VERSION,
    });

    return reply.code(result.queued ? 202 : 200).send({
      slug: metadata.slug,
      name: metadata.name,
      version: metadata.version,
      queued: result.queued,
      jobId: result.id,
      pluginUrl: `/plugins/${metadata.slug}`,
    });
  });

  app.get("/plugins/tracked", { preHandler: requireInternalAuth }, async (request) => {
    const query = listTrackedPluginsQuery.parse(request.query);
    return store.listTrackedPlugins(query);
  });

  app.get("/searches/recent", async (request) => {
    const query = listRecentSearchesQuery.parse(request.query);
    return store.listRecentSearches(query);
  });

  app.get("/authors", async (request) => {
    const query = listAuthorsQuery.parse(request.query);
    return store.listAuthors(query);
  });

  app.get("/authors/:author", async (request, reply) => {
    const { author } = z.object({ author: z.string() }).parse(request.params);
    const result = await store.getAuthor(decodeURIComponent(author));

    if (!result) {
      return reply.code(404).send({ error: "author_not_found" });
    }

    return result;
  });

  app.get("/tags", async (request) => {
    const query = listTagsQuery.parse(request.query);
    return store.listTags(query);
  });

  app.get("/tags/:tag", async (request, reply) => {
    const { tag } = z.object({ tag: z.string() }).parse(request.params);
    const query = tagDetailQuery.parse(request.query);
    const result = await store.getTag(decodeURIComponent(tag), query);

    if (!result) {
      return reply.code(404).send({ error: "tag_not_found" });
    }

    return result;
  });

  app.get("/domains", async (request) => {
    const query = listExternalDomainsQuery.parse(request.query);
    return store.listExternalDomains(query);
  });

  app.get("/domain-families", async (request) => {
    const query = listExternalDomainsQuery.parse(request.query);
    return store.listExternalDomainFamilies(query);
  });

  app.get("/domains/:domain", async (request, reply) => {
    const { domain } = z.object({ domain: z.string().min(1).max(255) }).parse(request.params);
    const query = externalDomainDetailQuery.parse(request.query);
    const result = await store.getExternalDomain(decodeURIComponent(domain), query);

    if (!result) {
      return reply.code(404).send({ error: "external_domain_not_found" });
    }

    return result;
  });

  app.post("/searches", async (request, reply) => {
    if (!searchRateLimiter.consume(request.ip)) {
      return reply
        .code(429)
        .header("Retry-After", "60")
        .send({ error: "rate_limited" });
    }

    const body = recordSearchBody.parse(request.body);
    const result = await store.recordSearch(normalizeSlug(body.slug));
    return reply.code(result.recorded ? 202 : 404).send(result);
  });

  app.get("/reports", { preHandler: requireInternalAuth }, async (request) => {
    const query = listPluginReportsQuery.parse(request.query);
    return store.listPluginReports({
      page: query.page,
      perPage: query.perPage,
      status: query.status,
      reportType: query.reportType,
      pluginSlug: query.pluginSlug ? normalizeSlug(query.pluginSlug) : undefined,
      hasContactEmail: query.hasContactEmail,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
    });
  });

  app.get("/reports/stats", { preHandler: requireInternalAuth }, async () => {
    return store.pluginReportStats();
  });

  app.patch("/reports/:id", { preHandler: requireInternalAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = updatePluginReportBody.parse(request.body);
    const report = await store.updatePluginReport(id, body);

    if (!report) {
      return reply.code(404).send({ error: "report_not_found" });
    }

    return report;
  });

  app.get("/queue", async (request) => {
    const query = listQueueQuery.parse(request.query);
    return store.listQueue(query);
  });

  app.get("/issues", async () => store.listIssues());

  app.get("/issues/:code", async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const issue = await store.getIssue(code);

    if (!issue) {
      return reply.code(404).send({ error: "issue_not_found" });
    }

    return issue;
  });

  app.post("/jobs", { preHandler: requireInternalAuth }, async (request, reply) => {
    const body = enqueueJobBody.parse(request.body);
    const result = await store.enqueueJob(body);
    return reply.code(result.queued ? 202 : 200).send(result);
  });

  app.get("/jobs/next", { preHandler: requireInternalAuth }, async (request, reply) => {
    const job = await store.claimNextJob();

    if (!job) {
      return reply.code(204).send();
    }

    return job;
  });

  app.post("/jobs/:id/complete", { preHandler: requireInternalAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = completeJobBody.parse(request.body);
    await store.completeJob(id, body);
    return reply.code(204).send();
  });

  app.post("/jobs/:id/fail", { preHandler: requireInternalAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const body = failJobBody.parse(request.body);
    await store.failJob(id, body);
    return reply.code(204).send();
  });

  app.addHook("onClose", async () => {
    await store.close();
  });

  return app;
}

function readBearerToken(authorization?: string) {
  const [scheme, token] = authorization?.split(/\s+/, 2) ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function tokensMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/wordpress\.org\/plugins\//, "")
    .replace(/^wordpress\.org\/plugins\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashIp(ip: string, secret?: string) {
  if (!secret) {
    return undefined;
  }

  return createHmac("sha256", secret).update(ip).digest("hex");
}

function truncateHeader(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value.join(", ") : value;
  return text ? text.slice(0, 500) : undefined;
}

function isUrlHeavy(message: string) {
  const matches = message.match(/https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}\//gi) ?? [];
  return matches.length > 2;
}

function createFixedWindowRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    consume(key: string) {
      if (!Number.isFinite(limit) || limit <= 0) {
        return true;
      }

      const now = Date.now();
      const current = hits.get(key);

      if (!current || current.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        cleanupExpiredHits(hits, now);
        return true;
      }

      if (current.count >= limit) {
        return false;
      }

      current.count += 1;
      return true;
    },
  };
}

function cleanupExpiredHits(
  hits: Map<string, { count: number; resetAt: number }>,
  now: number,
) {
  if (hits.size < 1000) {
    return;
  }

  for (const [key, value] of hits) {
    if (value.resetAt <= now) {
      hits.delete(key);
    }
  }
}
