import type { Metadata } from "next";
import type {
  ExternalDomainPluginSummary,
  ExternalDomainSummary,
  ExternalConnectionType,
} from "@pluginscore/core";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Boxes, ExternalLink, Globe2, Network, PackageSearch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PluginIcon } from "@/components/plugin-icon";
import { RelativeDate } from "@/components/relative-date";
import { ScoreBadge } from "@/components/score-badge";
import { getExternalDomain, getExternalDomains } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

const INDEXABLE_DOMAIN_PLUGIN_MINIMUM = 3;

type DomainPageProps = {
  params: Promise<{ domain: string }>;
};

export const revalidate = 1_800;

export async function generateStaticParams() {
  const domains = await getExternalDomains(100, INDEXABLE_DOMAIN_PLUGIN_MINIMUM);

  return domains
    .filter((domain) => !domain.platformReference)
    .map((domain) => ({ domain: domain.domain }));
}

export async function generateMetadata({
  params,
}: DomainPageProps): Promise<Metadata> {
  const { domain } = await params;
  const decodedDomain = decodeURIComponent(domain);
  const detail = await getExternalDomain(decodedDomain, 100);
  const displayDomain = detail?.domain ?? decodedDomain;
  const description =
    `WordPress plugins that reference ${displayDomain}, including outbound calls, external assets, and static analysis context from PluginScore.`;
  const shouldIndex = Boolean(
    detail &&
      detail.pluginCount >= INDEXABLE_DOMAIN_PLUGIN_MINIMUM &&
      !detail.platformReference,
  );

  return {
    ...seoMetadata({
      title: `${displayDomain} in WordPress Plugins`,
      description,
      path: `/domains/${encodeURIComponent(displayDomain)}`,
    }),
    robots: {
      index: shouldIndex,
      follow: true,
    },
  };
}

export default async function DomainPage({ params }: DomainPageProps) {
  const { domain } = await params;
  const detail = await getExternalDomain(decodeURIComponent(domain), 100);

  if (!detail) {
    notFound();
  }

  const outboundPlugins = detail.plugins.filter((item) =>
    item.referenceTypes.includes("outbound_http"),
  );
  const assetPlugins = detail.plugins.filter((item) =>
    item.referenceTypes.includes("external_asset"),
  );
  const externalDomainUrl = domainExternalUrl(detail.domain);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface">
        <div className="flex flex-col gap-4 border-b border-line p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
              <h1 className="break-all font-mono text-3xl font-semibold tracking-normal">
                {detail.domain}
              </h1>
              {externalDomainUrl ? (
                <a
                  href={externalDomainUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  aria-label={`Open ${detail.domain}`}
                  title={`Open ${detail.domain}`}
                  className="mt-1.5 shrink-0 rounded-md p-1 text-muted transition hover:bg-surface-subtle hover:text-foreground"
                >
                  <ExternalLink size={18} aria-hidden="true" />
                </a>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Potential connections found by static code analysis.
            </p>
          </div>
          {detail.platformReference ? (
            <span className="inline-flex w-fit rounded-md border border-line px-3 py-2 text-xs font-medium text-muted">
              Platform / reference
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <DomainMetric
            icon={<PackageSearch size={16} aria-hidden="true" />}
            label="Plugins detected"
            value={detail.pluginCount.toLocaleString()}
          />
          <DomainMetric
            icon={<Network size={16} aria-hidden="true" />}
            label="Outbound references"
            value={detail.outboundReferences.toLocaleString()}
          />
          <DomainMetric
            icon={<Boxes size={16} aria-hidden="true" />}
            label="External assets"
            value={detail.externalAssetReferences.toLocaleString()}
          />
          <DomainMetric
            icon={<Globe2 size={16} aria-hidden="true" />}
            label="Last seen"
            value={<RelativeDate value={detail.lastSeenAt} fallback="-" />}
          />
        </div>
      </section>

      <DomainCategorySplit
        outboundPlugins={outboundPlugins}
        assetPlugins={assetPlugins}
        summary={detail}
      />

      <section className="rounded-md border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="text-xl font-semibold">Plugins Referencing This Domain</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Plugin</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
                <th className="px-4 py-3 text-right font-medium">Installs</th>
                <th className="px-4 py-3 text-right font-medium">Issues</th>
                <th className="px-4 py-3 text-right font-medium">References</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Scanned</th>
              </tr>
            </thead>
            <tbody>
              {detail.plugins.map((item) => (
                <tr
                  key={item.plugin.slug}
                  className="border-b border-line last:border-b-0 transition hover:bg-surface-subtle/70"
                >
                  <td className="px-4 py-4">
                    <Link
                      href={`/plugins/${item.plugin.slug}`}
                      prefetch={false}
                      className="group flex min-w-0 items-center gap-2"
                    >
                      <PluginIcon plugin={item.plugin} size="xs" />
                      <span
                        className="block max-w-[38ch] truncate font-medium text-info group-hover:underline"
                        title={item.plugin.name}
                      >
                        {item.plugin.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {item.plugin.audited === false ? (
                      <span className="inline-flex rounded-md border border-line bg-surface-subtle px-2 py-1 text-xs font-semibold text-muted">
                        Pending
                      </span>
                    ) : (
                      <ScoreBadge score={item.plugin.score} band={item.plugin.band} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {item.plugin.activeInstalls}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {item.plugin.findings.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {item.referenceCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {referenceTypeLabel(item.referenceTypes)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-xs text-muted">
                    <RelativeDate value={item.analyzedAt} fallback="-" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function domainExternalUrl(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase().replace(/\.$/, "");

  if (
    !normalizedDomain ||
    /[\s/:@]/.test(normalizedDomain) ||
    normalizedDomain.startsWith(".") ||
    normalizedDomain.endsWith(".")
  ) {
    return undefined;
  }

  try {
    const url = new URL(`https://${normalizedDomain}`);

    if (url.hostname !== normalizedDomain) {
      return undefined;
    }

    return `https://${normalizedDomain}`;
  } catch {
    return undefined;
  }
}

function DomainMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DomainCategorySplit({
  outboundPlugins,
  assetPlugins,
  summary,
}: {
  outboundPlugins: ExternalDomainPluginSummary[];
  assetPlugins: ExternalDomainPluginSummary[];
  summary: ExternalDomainSummary;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <DomainCategoryPanel
        title="Outbound Calls"
        count={summary.outboundReferences}
        plugins={outboundPlugins}
        emptyLabel="No outbound call references detected."
      />
      <DomainCategoryPanel
        title="External Assets"
        count={summary.externalAssetReferences}
        plugins={assetPlugins}
        emptyLabel="No external asset references detected."
      />
    </section>
  );
}

function DomainCategoryPanel({
  title,
  count,
  plugins,
  emptyLabel,
}: {
  title: string;
  count: number;
  plugins: ExternalDomainPluginSummary[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="font-mono text-sm text-muted">{count.toLocaleString()}</span>
      </div>
      {plugins.length ? (
        <div className="divide-y divide-line">
          {plugins.slice(0, 6).map((item) => (
            <Link
              key={item.plugin.slug}
              href={`/plugins/${item.plugin.slug}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-surface-subtle/70"
            >
              <span className="min-w-0 truncate font-medium text-info">
                {item.plugin.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {typeReferenceCount(item, title).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

function referenceTypeLabel(types: ExternalConnectionType[]) {
  const hasOutbound = types.includes("outbound_http");
  const hasAsset = types.includes("external_asset");

  if (hasOutbound && hasAsset) {
    return "asset + outbound";
  }

  if (hasAsset) {
    return "asset";
  }

  if (hasOutbound) {
    return "outbound";
  }

  return "reference";
}

function typeReferenceCount(item: ExternalDomainPluginSummary, title: string) {
  return title === "External Assets"
    ? item.externalAssetReferences
    : item.outboundReferences;
}
