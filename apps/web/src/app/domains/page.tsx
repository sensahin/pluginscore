import { Box, Globe2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RelativeDate } from "@/components/relative-date";
import { getExternalDomains } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";
import type { ExternalDomainSummary } from "@pluginscore/core";

export const metadata = seoMetadata({
  title: "External Domains in WordPress Plugins",
  description:
    "Browse external domains referenced by WordPress plugins in PluginScore static code analysis, including outbound calls, external assets, and plugin counts.",
  path: "/domains",
});

export const revalidate = 1_800;

export default async function DomainsPage() {
  const domains = await getExternalDomains(200);
  const notableDomains = domains.filter((domain) => !domain.platformReference);
  const platformReferenceDomains = domains.filter((domain) => domain.platformReference);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">External Domains</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Potential external domains found by static code analysis.
        </p>
      </section>

      <DomainList title="Notable Domains" domains={notableDomains} />

      {platformReferenceDomains.length ? (
        <DomainList
          title="Platform / Reference Domains"
          domains={platformReferenceDomains}
          muted
        />
      ) : null}
    </AppShell>
  );
}

function DomainList({
  title,
  domains,
  muted = false,
}: {
  title: string;
  domains: ExternalDomainSummary[];
  muted?: boolean;
}) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <div className="border-b border-line p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {domains.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 text-right font-medium">Plugins</th>
                <th className="px-4 py-3 text-right font-medium">References</th>
                <th className="px-4 py-3 text-right font-medium">Outbound</th>
                <th className="px-4 py-3 text-right font-medium">Assets</th>
                <th className="px-4 py-3 text-right font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr
                  key={domain.domain}
                  className="border-b border-line last:border-b-0 transition hover:bg-surface-subtle/70"
                >
                  <td className="px-4 py-4">
                    <Link
                      href={`/domains/${encodeURIComponent(domain.domain)}`}
                      className={`group inline-flex max-w-[38ch] items-center gap-2 truncate font-mono font-medium ${
                        muted ? "text-muted hover:text-foreground" : "text-info hover:text-foreground"
                      }`}
                    >
                      <Globe2 size={15} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{domain.domain}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {domain.pluginCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {domain.totalReferences.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {domain.outboundReferences.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-mono">
                    {domain.externalAssetReferences.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-xs text-muted">
                    <RelativeDate value={domain.lastSeenAt} fallback="-" />
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
