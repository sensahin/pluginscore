"use client";

import type {
  Core,
  ElementDefinition,
  StylesheetJson,
} from "cytoscape";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject, type ReactNode } from "react";
import type {
  PluginRelationshipMapData,
  PluginRelationshipNode,
  RelationshipNodeType,
} from "@/lib/plugin-relationship-map";

type PositionedNode = PluginRelationshipNode & {
  x: number;
  y: number;
};

type RelationshipGraph = ReturnType<typeof buildCytoscapeElements>;

type GraphRenderOptions = {
  padding: number;
  minZoom: number;
  maxZoom: number;
  wheelSensitivity: number;
};

const nodeTypeLabels: Record<RelationshipNodeType, string> = {
  ranking: "Ranking",
  plugin: "Plugin",
  author: "Author",
  tag: "Category",
  issue: "Issue",
  domain: "Domain",
  relatedPlugin: "Related",
};

export function PluginRelationshipMap({
  data,
  title = "Relationship Map",
  description = "Author, categories, issues, domains, and nearby plugins.",
  linksLabel = "Relationship links",
  sectionId = "relationship-map",
}: {
  data: PluginRelationshipMapData;
  title?: string;
  description?: string;
  linksLabel?: string;
  sectionId?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graph = useMemo(() => buildCytoscapeElements(data), [data]);
  const {
    containerRef: inlineContainerRef,
    cyRef: inlineCyRef,
    loaded: inlineLoaded,
  } = useRelationshipGraph(graph, {
    padding: 36,
    minZoom: 0.45,
    maxZoom: 2.2,
    wheelSensitivity: 0.18,
  });

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  if (data.nodes.length <= 1) {
    return null;
  }

  return (
    <section id={sectionId} className="rounded-md border border-line bg-surface shadow-sm">
      <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <span className="inline-flex w-fit rounded-md border border-line px-3 py-2 font-mono text-sm text-muted">
          {data.nodes.length.toLocaleString()} nodes
        </span>
      </div>

      <div className="hidden p-5 md:block">
        <div className="relative h-[430px] overflow-hidden rounded-md border border-line bg-background">
          <div ref={inlineContainerRef} className="h-full w-full" aria-hidden="true" />
          <MapControls
            onFullscreen={() => setIsFullscreen(true)}
            onReset={() => fitGraph(inlineCyRef.current)}
            onZoomIn={() => zoomGraph(inlineCyRef.current, 1.18)}
            onZoomOut={() => zoomGraph(inlineCyRef.current, 0.84)}
          />
          {!inlineLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
              Loading map
            </div>
          ) : null}
        </div>
        <GraphLegend nodes={data.nodes} />
        <details className="mt-4 rounded-md border border-line bg-background">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            {linksLabel}
          </summary>
          <div className="border-t border-line p-3">
            <RelationshipLinkList data={data} />
          </div>
        </details>
      </div>

      <div className="p-5 md:hidden">
        <RelationshipLinkList data={data} />
      </div>

      {isFullscreen ? (
        <FullscreenMap
          data={data}
          graph={graph}
          title={title}
          onClose={() => setIsFullscreen(false)}
        />
      ) : null}
    </section>
  );
}

function FullscreenMap({
  data,
  graph,
  title,
  onClose,
}: {
  data: PluginRelationshipMapData;
  graph: RelationshipGraph;
  title: string;
  onClose: () => void;
}) {
  const {
    containerRef: fullscreenContainerRef,
    cyRef: fullscreenCyRef,
    loaded: fullscreenLoaded,
  } = useRelationshipGraph(graph, {
    padding: 56,
    minZoom: 0.35,
    maxZoom: 3,
    wheelSensitivity: 0.16,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-background/96 p-4 backdrop-blur-sm md:p-6"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-line p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted">
              {data.nodes.length.toLocaleString()} nodes
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <MapIconButton label="Zoom in" onClick={() => zoomGraph(fullscreenCyRef.current, 1.18)}>
              <ZoomIn size={16} aria-hidden="true" />
            </MapIconButton>
            <MapIconButton label="Zoom out" onClick={() => zoomGraph(fullscreenCyRef.current, 0.84)}>
              <ZoomOut size={16} aria-hidden="true" />
            </MapIconButton>
            <MapIconButton label="Reset view" onClick={() => fitGraph(fullscreenCyRef.current)}>
              <RotateCcw size={16} aria-hidden="true" />
            </MapIconButton>
            <MapIconButton label="Exit fullscreen" onClick={onClose}>
              <Minimize2 size={16} aria-hidden="true" />
            </MapIconButton>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 bg-background">
          <div ref={fullscreenContainerRef} className="h-full w-full" aria-hidden="true" />
          {!fullscreenLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
              Loading map
            </div>
          ) : null}
        </div>
        <div className="border-t border-line px-4 py-3">
          <GraphLegend nodes={data.nodes} />
        </div>
      </div>
    </div>
  );
}

function MapControls({
  onFullscreen,
  onReset,
  onZoomIn,
  onZoomOut,
}: {
  onFullscreen: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
      <MapIconButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={16} aria-hidden="true" />
      </MapIconButton>
      <MapIconButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={16} aria-hidden="true" />
      </MapIconButton>
      <MapIconButton label="Reset view" onClick={onReset}>
        <RotateCcw size={16} aria-hidden="true" />
      </MapIconButton>
      <MapIconButton label="Fullscreen" onClick={onFullscreen}>
        <Maximize2 size={16} aria-hidden="true" />
      </MapIconButton>
    </div>
  );
}

function MapIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function useRelationshipGraph(
  graph: RelationshipGraph,
  options: GraphRenderOptions,
): {
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: RefObject<Core | null>;
  loaded: boolean;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

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
        layout: { name: "preset", fit: true, padding: options.padding },
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        wheelSensitivity: options.wheelSensitivity,
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
  }, [graph, options.maxZoom, options.minZoom, options.padding, options.wheelSensitivity, router]);

  return { containerRef, cyRef, loaded };
}

function zoomGraph(cy: Core | null, factor: number) {
  if (!cy) {
    return;
  }

  const level = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor));
  cy.zoom({
    level,
    renderedPosition: {
      x: cy.width() / 2,
      y: cy.height() / 2,
    },
  });
}

function fitGraph(cy: Core | null) {
  cy?.fit(undefined, 36);
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
        band: node.band ?? "",
        center: node.id === data.centerNodeId ? "true" : "false",
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
  }> = center?.type === "author"
    ? [
        { type: "plugin", radius: 190, start: -172, end: 172 },
        { type: "tag", radius: 300, start: 190, end: 530 },
      ]
    : center?.type === "ranking"
      ? [
          { type: "plugin", radius: 250, start: -176, end: 176 },
          { type: "tag", radius: 380, start: -172, end: 8 },
          { type: "author", radius: 380, start: 18, end: 172 },
        ]
    : [
        { type: "author", radius: 135, start: -98, end: -82 },
        { type: "tag", radius: 190, start: -180, end: -22 },
        { type: "issue", radius: 225, start: 10, end: 128 },
        { type: "domain", radius: 245, start: 138, end: 220 },
        { type: "relatedPlugin", radius: 295, start: 228, end: 350 },
      ];

  for (const group of groups) {
    const nodes = data.nodes.filter(
      (node) => node.type === group.type && node.id !== data.centerNodeId,
    );
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
        "border-width": 2,
        color: colors.foreground,
        "font-size": 13,
        "font-weight": 700,
        "text-max-width": 140,
      },
    },
    {
      selector: 'node[type = "ranking"]',
      style: {
        "background-color": colors.brand,
        "border-color": colors.brandStrong,
        "border-width": 3,
        color: colors.foreground,
        "font-size": 13,
        "font-weight": 700,
        "text-max-width": 130,
      },
    },
    {
      selector: 'node[type = "plugin"][band = "excellent"]',
      style: {
        "background-color": colors.good,
        "border-color": colors.good,
      },
    },
    {
      selector: 'node[type = "plugin"][band = "good"]',
      style: {
        "background-color": colors.brand,
        "border-color": colors.brand,
      },
    },
    {
      selector: 'node[type = "plugin"][band = "watch"]',
      style: {
        "background-color": colors.warn,
        "border-color": colors.warn,
      },
    },
    {
      selector: 'node[type = "plugin"][band = "risk"]',
      style: {
        "background-color": colors.risk,
        "border-color": colors.risk,
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
    {
      selector: 'node[center = "true"]',
      style: {
        "border-color": colors.brandStrong,
        "border-width": 4,
        "font-size": 13,
        "font-weight": 700,
        "text-max-width": 140,
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

function GraphLegend({ nodes }: { nodes: PluginRelationshipNode[] }) {
  const visibleTypes = new Set(nodes.map((node) => node.type));
  const allEntries: Array<{ type: RelationshipNodeType; label: string }> = [
    { type: "ranking", label: "Ranking" },
    { type: "plugin", label: "Plugin" },
    { type: "author", label: "Author" },
    { type: "tag", label: "Category" },
    { type: "issue", label: "Issue" },
    { type: "domain", label: "Domain" },
    { type: "relatedPlugin", label: "Related" },
  ];
  const entries = allEntries.filter((entry) => visibleTypes.has(entry.type));

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
  const order: RelationshipNodeType[] = ["ranking", "plugin", "author", "tag", "issue", "domain", "relatedPlugin"];

  return order
    .map((type) => ({
      type,
      nodes: nodes.filter((node) => node.type === type),
    }))
    .filter((group) => group.nodes.length > 0);
}

function legendDotClass(type: RelationshipNodeType) {
  if (type === "ranking") return "bg-brand ring-1 ring-brand-strong";
  if (type === "plugin") return "bg-brand ring-1 ring-good/60";
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
