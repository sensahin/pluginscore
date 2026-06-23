"use client";

import type {
  Core,
  ElementDefinition,
  StylesheetJson,
} from "cytoscape";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PluginRelationshipMapData,
  PluginRelationshipNode,
  RelationshipNodeType,
} from "@/lib/plugin-relationship-map";

type PositionedNode = PluginRelationshipNode & {
  x: number;
  y: number;
};

const nodeTypeLabels: Record<RelationshipNodeType, string> = {
  plugin: "Plugin",
  author: "Author",
  tag: "Category",
  issue: "Issue",
  domain: "Domain",
  relatedPlugin: "Related",
};

export function PluginRelationshipMap({
  data,
}: {
  data: PluginRelationshipMapData;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const graph = useMemo(() => buildCytoscapeElements(data), [data]);

  useEffect(() => {
    let cancelled = false;

    async function renderGraph() {
      const container = containerRef.current;

      if (!container || graph.elements.length === 0) {
        return;
      }

      setLoaded(false);
      const cytoscapeModule = await import("cytoscape");

      if (cancelled) {
        return;
      }

      const colors = graphColors();
      const cy = cytoscapeModule.default({
        container,
        elements: graph.elements,
        layout: { name: "preset", fit: true, padding: 36 },
        minZoom: 0.45,
        maxZoom: 2.2,
        wheelSensitivity: 0.18,
        style: relationshipGraphStyle(colors),
      });

      cy.on("tap", "node", (event) => {
        const href = event.target.data("href") as string | undefined;
        const external = event.target.data("external") as boolean | undefined;

        if (!href) {
          return;
        }

        if (external) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }

        router.push(href);
      });

      cy.on("mouseover", "node", () => {
        container.style.cursor = "pointer";
      });
      cy.on("mouseout", "node", () => {
        container.style.cursor = "";
      });

      cyRef.current = cy;
      setLoaded(true);
    }

    renderGraph();

    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [graph, router]);

  if (data.nodes.length <= 1) {
    return null;
  }

  return (
    <section id="relationship-map" className="rounded-md border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Relationship Map</h2>
          <p className="mt-1 text-sm text-muted">
            Author, categories, issues, domains, and nearby plugins.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-md border border-line px-3 py-2 font-mono text-sm text-muted">
          {data.nodes.length.toLocaleString()} nodes
        </span>
      </div>

      <div className="hidden p-5 md:block">
        <div className="relative h-[430px] overflow-hidden rounded-md border border-line bg-background">
          <div ref={containerRef} className="h-full w-full" aria-hidden="true" />
          {!loaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
              Loading map
            </div>
          ) : null}
        </div>
        <GraphLegend />
        <details className="mt-4 rounded-md border border-line bg-background">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Relationship links
          </summary>
          <div className="border-t border-line p-3">
            <RelationshipLinkList data={data} />
          </div>
        </details>
      </div>

      <div className="p-5 md:hidden">
        <RelationshipLinkList data={data} />
      </div>
    </section>
  );
}

function buildCytoscapeElements(data: PluginRelationshipMapData) {
  const positionedNodes = positionNodes(data);
  const nodeIds = new Set(positionedNodes.map((node) => node.id));
  const elements: ElementDefinition[] = [
    ...positionedNodes.map((node) => ({
      data: {
        id: node.id,
        label: compactLabel(node.label, node.type === "plugin" ? 34 : 24),
        type: node.type,
        href: node.href,
        external: Boolean(node.external),
        metric: node.metric ?? nodeTypeLabels[node.type],
        size: node.size,
      },
      position: { x: node.x, y: node.y },
    })),
    ...data.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label ?? "",
        },
      })),
  ];

  return { elements };
}

function positionNodes(data: PluginRelationshipMapData): PositionedNode[] {
  const center = data.nodes.find((node) => node.id === data.centerNodeId);
  const positioned: PositionedNode[] = center
    ? [{ ...center, x: 0, y: 0 }]
    : [];
  const groups: Array<{
    type: RelationshipNodeType;
    radius: number;
    start: number;
    end: number;
  }> = [
    { type: "author", radius: 135, start: -98, end: -82 },
    { type: "tag", radius: 190, start: -180, end: -22 },
    { type: "issue", radius: 225, start: 10, end: 128 },
    { type: "domain", radius: 245, start: 138, end: 220 },
    { type: "relatedPlugin", radius: 295, start: 228, end: 350 },
  ];

  for (const group of groups) {
    const nodes = data.nodes.filter((node) => node.type === group.type);
    const count = nodes.length;

    nodes.forEach((node, index) => {
      const angle = count <= 1
        ? (group.start + group.end) / 2
        : group.start + ((group.end - group.start) * index) / (count - 1);
      const radians = (angle * Math.PI) / 180;

      positioned.push({
        ...node,
        x: Math.cos(radians) * group.radius,
        y: Math.sin(radians) * group.radius,
      });
    });
  }

  return positioned;
}

function relationshipGraphStyle(colors: ReturnType<typeof graphColors>): StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        "background-color": colors.muted,
        "border-color": colors.line,
        "border-width": 1,
        color: colors.foreground,
        "font-family": "Geist, ui-sans-serif, system-ui, sans-serif",
        "font-size": 11,
        height: "data(size)",
        label: "data(label)",
        "min-zoomed-font-size": 8,
        "overlay-opacity": 0,
        "text-background-color": colors.background,
        "text-background-opacity": 0.82,
        "text-background-padding": 2,
        "text-margin-y": 8,
        "text-max-width": 92,
        "text-valign": "bottom",
        "text-wrap": "wrap",
        width: "data(size)",
      },
    },
    {
      selector: 'node[type = "plugin"]',
      style: {
        "background-color": colors.brand,
        "border-color": colors.brandStrong,
        "border-width": 4,
        color: colors.foreground,
        "font-size": 13,
        "font-weight": 700,
        "text-max-width": 140,
      },
    },
    {
      selector: 'node[type = "author"]',
      style: {
        "background-color": colors.info,
      },
    },
    {
      selector: 'node[type = "tag"]',
      style: {
        "background-color": colors.good,
      },
    },
    {
      selector: 'node[type = "issue"]',
      style: {
        "background-color": colors.warn,
      },
    },
    {
      selector: 'node[type = "domain"]',
      style: {
        "background-color": colors.risk,
      },
    },
    {
      selector: 'node[type = "relatedPlugin"]',
      style: {
        "background-color": colors.surfaceSubtle,
        "border-color": colors.brand,
        "border-width": 2,
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "line-color": colors.line,
        "line-opacity": 0.88,
        "overlay-opacity": 0,
        width: 1.4,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": colors.foreground,
        "border-width": 3,
      },
    },
  ] as unknown as StylesheetJson;
}

function graphColors() {
  const root = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    root.getPropertyValue(name).trim() || fallback;

  return {
    background: read("--background", "#111315"),
    foreground: read("--foreground", "#f2f4f7"),
    muted: read("--muted", "#a2aab4"),
    surfaceSubtle: read("--surface-subtle", "#22272d"),
    line: read("--line", "#303741"),
    brand: read("--brand", "#58b9a2"),
    brandStrong: read("--brand-strong", "#8bd8c6"),
    risk: read("--risk", "#ff897d"),
    warn: read("--warn", "#f5c451"),
    good: read("--good", "#75d197"),
    info: read("--info", "#85aaf0"),
  };
}

function GraphLegend() {
  const entries: Array<{ type: RelationshipNodeType; label: string }> = [
    { type: "plugin", label: "Plugin" },
    { type: "author", label: "Author" },
    { type: "tag", label: "Category" },
    { type: "issue", label: "Issue" },
    { type: "domain", label: "Domain" },
    { type: "relatedPlugin", label: "Related" },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
      {entries.map((entry) => (
        <span key={entry.type} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1">
          <span className={`size-2 rounded-full ${legendDotClass(entry.type)}`} />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

function RelationshipLinkList({ data }: { data: PluginRelationshipMapData }) {
  const groups = groupNodesForList(data.nodes);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.type}>
          <h3 className="text-xs font-medium uppercase text-muted">
            {nodeTypeLabels[group.type]}
          </h3>
          <div className="mt-2 divide-y divide-line rounded-md border border-line">
            {group.nodes.map((node) => (
              <RelationshipNodeLink key={node.id} node={node} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipNodeLink({ node }: { node: PluginRelationshipNode }) {
  const className = "flex items-center justify-between gap-3 px-3 py-2 text-sm";
  const content = (
    <>
      <span className="min-w-0 truncate font-medium">{node.label}</span>
      {node.metric ? (
        <span className="shrink-0 text-xs text-muted">{node.metric}</span>
      ) : null}
    </>
  );

  if (node.external) {
    return (
      <a href={node.href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={node.href} prefetch={false} className={className}>
      {content}
    </Link>
  );
}

function groupNodesForList(nodes: PluginRelationshipNode[]) {
  const order: RelationshipNodeType[] = ["plugin", "author", "tag", "issue", "domain", "relatedPlugin"];

  return order
    .map((type) => ({
      type,
      nodes: nodes.filter((node) => node.type === type),
    }))
    .filter((group) => group.nodes.length > 0);
}

function legendDotClass(type: RelationshipNodeType) {
  if (type === "plugin") return "bg-brand";
  if (type === "author") return "bg-info";
  if (type === "tag") return "bg-good";
  if (type === "issue") return "bg-warn";
  if (type === "domain") return "bg-risk";
  return "bg-surface-subtle ring-1 ring-brand";
}

function compactLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
