import type {
  ExternalConnectionAnalysisSummary,
  ExternalConnectionDomainSummary,
  FindingCodeCount,
  PluginDetail,
  PluginSummary,
} from "@pluginscore/core";

export type RelationshipNodeType =
  | "plugin"
  | "author"
  | "tag"
  | "issue"
  | "domain"
  | "relatedPlugin";

export type PluginRelationshipNode = {
  id: string;
  type: RelationshipNodeType;
  label: string;
  href: string;
  external?: boolean;
  metric?: string;
  size: number;
};

export type PluginRelationshipEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type PluginRelationshipMapData = {
  centerNodeId: string;
  nodes: PluginRelationshipNode[];
  edges: PluginRelationshipEdge[];
  stats: {
    tags: number;
    issues: number;
    domains: number;
    relatedPlugins: number;
  };
};

export type RelationshipRelatedPluginGroup = {
  id: string;
  label: string;
  plugins: PluginSummary[];
};

export type RelationshipIssuePluginGroup = {
  issue: Pick<FindingCodeCount, "code" | "title">;
  plugins: PluginSummary[];
};

const MAX_GRAPH_NODES = 48;
const MAX_GRAPH_EDGES = 90;

export function buildPluginRelationshipMap(
  plugin: PluginDetail,
  relatedTabs: RelationshipRelatedPluginGroup[],
  issueRelatedGroups: RelationshipIssuePluginGroup[] = [],
): PluginRelationshipMapData {
  const nodes = new Map<string, PluginRelationshipNode>();
  const edges = new Map<string, PluginRelationshipEdge>();
  const centerNodeId = relationshipId("plugin", plugin.slug);
  const tagNodeIds = new Map<string, string>();
  const issueNodeIds = new Map<string, string>();
  let authorNodeId: string | undefined;

  addNode(nodes, {
    id: centerNodeId,
    type: "plugin",
    label: plugin.name,
    href: `/plugins/${encodeURIComponent(plugin.slug)}`,
    metric: `${plugin.score} score`,
    size: pluginNodeSize(plugin, true),
  });

  if (plugin.author) {
    authorNodeId = relationshipId("author", plugin.author);
    if (addNode(nodes, {
      id: authorNodeId,
      type: "author",
      label: plugin.author,
      href: `/authors/${encodeURIComponent(plugin.author)}`,
      metric: "author",
      size: 34,
    })) {
      addEdge(edges, centerNodeId, authorNodeId, "author");
    }
  }

  for (const tag of (plugin.tags ?? []).slice(0, 8)) {
    const nodeId = relationshipId("tag", tag.slug);
    tagNodeIds.set(tag.slug, nodeId);
    if (addNode(nodes, {
      id: nodeId,
      type: "tag",
      label: tag.name,
      href: `/tags/${encodeURIComponent(tag.slug)}`,
      metric: "category",
      size: 30,
    })) {
      addEdge(edges, centerNodeId, nodeId, "category");
    }
  }

  for (const finding of (plugin.topFindings ?? []).slice(0, 8)) {
    const nodeId = relationshipId("issue", finding.code);
    issueNodeIds.set(finding.code, nodeId);
    if (addNode(nodes, {
      id: nodeId,
      type: "issue",
      label: finding.title,
      href: `/issues/${encodeURIComponent(finding.code)}`,
      metric: `${finding.count.toLocaleString()} finding${finding.count === 1 ? "" : "s"}`,
      size: finding.severity === "error" ? 34 : 30,
    })) {
      addEdge(edges, centerNodeId, nodeId, "issue");
    }
  }

  for (const domain of graphDomains(plugin.externalConnections).slice(0, 8)) {
    const nodeId = relationshipId("domain", domain.domain);
    if (addNode(nodes, {
      id: nodeId,
      type: "domain",
      label: domain.domain,
      href: `https://${domain.domain}`,
      external: true,
      metric: `${domain.count.toLocaleString()} signal${domain.count === 1 ? "" : "s"}`,
      size: domain.types.includes("external_asset") ? 32 : 28,
    })) {
      addEdge(edges, centerNodeId, nodeId, "domain");
    }
  }

  const relatedSources = collectRelatedPluginSources(relatedTabs, issueRelatedGroups, plugin.slug);
  for (const source of relatedSources) {
    if (nodes.size >= MAX_GRAPH_NODES) {
      break;
    }

    const related = source.plugin;
    const nodeId = relationshipId("relatedPlugin", related.slug);
    if (!addNode(nodes, {
      id: nodeId,
      type: "relatedPlugin",
      label: related.name,
      href: `/plugins/${encodeURIComponent(related.slug)}`,
      metric: `${related.score} score`,
      size: pluginNodeSize(related, false),
    })) {
      continue;
    }

    addEdge(edges, centerNodeId, nodeId, "related");

    if (source.relations.has("Author") && authorNodeId) {
      addEdge(edges, authorNodeId, nodeId, "author");
    }

    let tagEdges = 0;
    for (const tag of related.tags ?? []) {
      const tagNodeId = tagNodeIds.get(tag.slug);
      if (!tagNodeId) {
        continue;
      }

      addEdge(edges, tagNodeId, nodeId, "category");
      tagEdges += 1;
      if (tagEdges >= 2) {
        break;
      }
    }

    for (const issueCode of source.issueCodes) {
      const issueNodeId = issueNodeIds.get(issueCode);
      if (issueNodeId) {
        addEdge(edges, issueNodeId, nodeId, "issue");
        break;
      }
    }
  }

  const nodeList = [...nodes.values()];

  return {
    centerNodeId,
    nodes: nodeList,
    edges: [...edges.values()].filter(
      (edge) =>
        nodes.has(edge.source) &&
        nodes.has(edge.target) &&
        edge.source !== edge.target,
    ),
    stats: {
      tags: nodeList.filter((node) => node.type === "tag").length,
      issues: nodeList.filter((node) => node.type === "issue").length,
      domains: nodeList.filter((node) => node.type === "domain").length,
      relatedPlugins: nodeList.filter((node) => node.type === "relatedPlugin").length,
    },
  };
}

function addNode(
  nodes: Map<string, PluginRelationshipNode>,
  node: PluginRelationshipNode,
) {
  if (nodes.has(node.id)) {
    return false;
  }

  if (nodes.size >= MAX_GRAPH_NODES) {
    return false;
  }

  nodes.set(node.id, node);
  return true;
}

function addEdge(
  edges: Map<string, PluginRelationshipEdge>,
  source: string,
  target: string,
  label?: string,
) {
  if (edges.size >= MAX_GRAPH_EDGES || source === target) {
    return;
  }

  const id = relationshipId("edge", `${source}-${target}-${label ?? "link"}`);
  if (!edges.has(id)) {
    edges.set(id, { id, source, target, label });
  }
}

function collectRelatedPluginSources(
  relatedTabs: RelationshipRelatedPluginGroup[],
  issueRelatedGroups: RelationshipIssuePluginGroup[],
  currentSlug: string,
) {
  const bySlug = new Map<string, {
    plugin: PluginSummary;
    relations: Set<string>;
    issueCodes: Set<string>;
  }>();

  for (const tab of relatedTabs) {
    for (const plugin of tab.plugins.slice(0, 6)) {
      if (plugin.slug === currentSlug) {
        continue;
      }

      const existing = bySlug.get(plugin.slug) ?? {
        plugin,
        relations: new Set<string>(),
        issueCodes: new Set<string>(),
      };
      existing.relations.add(tab.label);
      bySlug.set(plugin.slug, existing);
    }
  }

  for (const group of issueRelatedGroups) {
    for (const plugin of group.plugins.slice(0, 6)) {
      if (plugin.slug === currentSlug) {
        continue;
      }

      const existing = bySlug.get(plugin.slug) ?? {
        plugin,
        relations: new Set<string>(),
        issueCodes: new Set<string>(),
      };
      existing.relations.add("Issue");
      existing.issueCodes.add(group.issue.code);
      bySlug.set(plugin.slug, existing);
    }
  }

  return [...bySlug.values()]
    .sort((a, b) => relationWeight(b) - relationWeight(a) || pluginPopularity(b.plugin) - pluginPopularity(a.plugin))
    .slice(0, 14);
}

function relationWeight(source: { relations: Set<string>; issueCodes: Set<string> }) {
  return source.relations.size * 10 + source.issueCodes.size * 4;
}

function graphDomains(analysis?: ExternalConnectionAnalysisSummary) {
  if (!analysis || analysis.status !== "complete") {
    return [];
  }

  const nonPlatformDomains = analysis.domains.filter((domain) => !isPlatformReferenceDomain(domain));
  const assetDomains = nonPlatformDomains.filter((domain) => domain.types.includes("external_asset"));
  const outboundDomains = nonPlatformDomains.filter((domain) => !domain.types.includes("external_asset"));
  const fallbackDomains = analysis.domains.filter(isPlatformReferenceDomain).slice(0, 4);

  return [...assetDomains, ...outboundDomains, ...fallbackDomains];
}

function isPlatformReferenceDomain(domain: ExternalConnectionDomainSummary) {
  const value = domain.domain.toLowerCase().replace(/^www\./, "");

  return (
    value === "wordpress.org" ||
    value.endsWith(".wordpress.org") ||
    value === "w.org" ||
    value.endsWith(".w.org") ||
    value === "w3.org" ||
    value.endsWith(".w3.org") ||
    value === "schema.org" ||
    value.endsWith(".schema.org") ||
    value === "gnu.org" ||
    value.endsWith(".gnu.org") ||
    value === "fsf.org" ||
    value.endsWith(".fsf.org") ||
    value === "opensource.org" ||
    value.endsWith(".opensource.org") ||
    (value === "github.com" && domain.confidence === "low")
  );
}

function pluginNodeSize(plugin: Pick<PluginSummary, "score" | "activeInstalls">, isCenter: boolean) {
  const scoreSize = Math.max(0, Math.min(100, plugin.score)) / (isCenter ? 4 : 8);
  const installSize = Math.min(14, Math.log10(pluginPopularity(plugin) + 10) * 2);
  const base = isCenter ? 46 : 24;

  return Math.round(base + scoreSize + installSize);
}

function pluginPopularity(plugin: Pick<PluginSummary, "activeInstalls">) {
  const normalized = plugin.activeInstalls.toLowerCase().replace("+", "");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (normalized.endsWith("m")) {
    return parsed * 1_000_000;
  }

  if (normalized.endsWith("k")) {
    return parsed * 1_000;
  }

  return parsed;
}

function relationshipId(prefix: string, value: string) {
  return `${prefix}-${value}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
