import { Box, Globe2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RelativeDate } from "@/components/relative-date";
import { getExternalDomainFamilies } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import type { ExternalDomainFamilySummary, ExternalDomainSummary } from "@pluginscore/core";

export const metadata = seoMetadata({
  title: "External Domains in WordPress Plugins",
  description:
    "Browse external domains referenced by WordPress plugins in PluginScore static code analysis, including outbound calls, external assets, and plugin counts.",
  path: "/domains",
});

export const revalidate = 1_800;

export default async function DomainsPage() {
  const families = await getExternalDomainFamilies(200);
  const notableFamilies = families.filter((family) => family.classification === "standard");
  const platformReferenceFamilies = families.filter(
    (family) => family.classification === "platform_reference",
  );
  const cleanupFamilies = families.filter(
    (family) =>
      family.classification === "placeholder" ||
      family.classification === "invalid",
  );

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">External Domains</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Potential external domains found by static code analysis.
        </p>
      </section>

      <DomainFamilyList title="Notable Domains" families={notableFamilies} />

      {platformReferenceFamilies.length ? (
        <DomainFamilyList
          title="Platform / Reference Domains"
          families={platformReferenceFamilies}
          muted
        />
      ) : null}

      {cleanupFamilies.length ? (
        <DomainFamilyList
          title="Placeholder / Invalid Domains"
          families={cleanupFamilies}
          muted
          cleanup
        />
      ) : null}
    </AppShell>
  );
}

function DomainFamilyList({
  title,
  families,
  muted = false,
  cleanup = false,
}: {
  title: string;
  families: ExternalDomainFamilySummary[];
  muted?: boolean;
  cleanup?: boolean;
}) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="border-b border-line p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {families.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Domain Family</th>
                <th className="px-4 py-3 text-right font-medium">Domains</th>
                <th className="px-4 py-3 text-right font-medium">Plugins</th>
                <th className="px-4 py-3 text-right font-medium">References</th>
                <th className="px-4 py-3 text-right font-medium">Outbound</th>
                <th className="px-4 py-3 text-right font-medium">Assets</th>
                <th className="px-4 py-3 text-right font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <tr
                  key={family.rootDomain}
                  className="border-b border-line last:border-b-0 transition hover:bg-surface-subtle/70"
                >
                  <td className="px-4 py-4">
                    <div className="min-w-0">
                      <DomainRootLabel family={family} muted={muted} cleanup={cleanup} />
                      <DomainChildren domains={family.domains} muted={muted} cleanup={cleanup} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {family.domainCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {family.pluginCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {family.totalReferences.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {family.outboundReferences.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {family.externalAssetReferences.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-xs text-muted">
                    <RelativeDate value={family.lastSeenAt} fallback="-" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-5 text-sm text-muted">
          <Box size={18} aria-hidden="true" />
          No external domains detected yet.
        </div>
      )}
    </section>
  );
}

function DomainRootLabel({
  family,
  muted,
  cleanup,
}: {
  family: ExternalDomainFamilySummary;
  muted: boolean;
  cleanup: boolean;
}) {
  const content = (
    <>
      <Globe2 size={15} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{family.rootDomain}</span>
    </>
  );
  const className = `group inline-flex max-w-[40ch] items-center gap-2 truncate font-mono font-medium ${
    muted ? "text-muted hover:text-foreground" : "text-info hover:text-foreground"
  }`;

  if (cleanup || family.classification === "invalid" || family.classification === "placeholder") {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link
      href={`/domains/${encodeURIComponent(family.rootDomain)}`}
      className={className}
    >
      {content}
    </Link>
  );
}

function DomainChildren({
  domains,
  muted,
  cleanup,
}: {
  domains: ExternalDomainSummary[];
  muted: boolean;
  cleanup: boolean;
}) {
  const children = domains.filter((domain) => domain.isSubdomain);
  const visibleChildren = children.slice(0, 5);
  const hiddenCount = Math.max(0, children.length - visibleChildren.length);

  if (!children.length) {
    return null;
  }

  return (
    <div className="mt-2 flex max-w-[54ch] flex-wrap gap-1.5">
      {visibleChildren.map((domain) => {
        const className = `max-w-[22ch] truncate rounded-md border border-line px-2 py-1 font-mono text-[11px] ${
          muted ? "text-muted" : "text-muted hover:text-foreground"
        }`;

        if (cleanup || domain.classification === "invalid" || domain.classification === "placeholder") {
          return (
            <span key={domain.domain} className={className}>
              {domain.domain}
            </span>
          );
        }

        return (
          <Link
            key={domain.domain}
            href={`/domains/${encodeURIComponent(domain.domain)}`}
            className={className}
          >
            {domain.domain}
          </Link>
        );
      })}
      {hiddenCount ? (
        <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted">
          +{hiddenCount.toLocaleString()} more
        </span>
      ) : null}
    </div>
  );
}
