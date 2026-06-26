"use client";

import { Box, Globe2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RelativeDate } from "@/components/relative-date";
import type { ExternalDomainSummary } from "@pluginscore/core";

type DomainTabId =
  | "notable"
  | "apis"
  | "commerce"
  | "assets"
  | "reference"
  | "all";

type DomainTab = {
  id: DomainTabId;
  label: string;
};

const domainTabs: DomainTab[] = [
  { id: "notable", label: "Notable" },
  { id: "apis", label: "APIs & Services" },
  { id: "commerce", label: "Payments & Commerce" },
  { id: "assets", label: "External Assets" },
  { id: "reference", label: "Platform / Reference" },
  { id: "all", label: "All" },
];

export function DomainBrowser({ domains }: { domains: ExternalDomainSummary[] }) {
  const [activeTabId, setActiveTabId] = useState<DomainTabId>("notable");
  const [query, setQuery] = useState("");
  const groupedDomains = useMemo(
    () =>
      domainTabs.map((tab) => ({
        ...tab,
        domains: sortDomainsForTab(tab.id, domains.filter((domain) => domainBelongsToTab(domain, tab.id))),
      })),
    [domains],
  );
  const activeTab =
    groupedDomains.find((tab) => tab.id === activeTabId) ?? groupedDomains[0];
  const normalizedQuery = normalizeDomain(query);
  const visibleDomains = useMemo(
    () =>
      normalizedQuery
        ? activeTab.domains.filter((domain) => normalizeDomain(domain.domain).includes(normalizedQuery))
        : activeTab.domains,
    [activeTab.domains, normalizedQuery],
  );

  return (
    <section className="rounded-md border border-line bg-surface">
      <div
        role="tablist"
        aria-label="External domain categories"
        className="flex gap-2 overflow-x-auto p-5"
      >
        {groupedDomains.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            aria-controls={`domains-${tab.id}`}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
              tab.id === activeTab.id
                ? "border-brand/40 bg-brand/10 text-foreground"
                : "border-line text-muted hover:bg-surface-subtle hover:text-foreground"
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="rounded-md border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-muted">
              {tab.domains.length.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-y border-line p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{activeTab.label}</h2>
          <p className="mt-1 text-sm text-muted">
            {visibleDomains.length.toLocaleString()} domain
            {visibleDomains.length === 1 ? "" : "s"}
          </p>
        </div>
        <label className="relative w-full md:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            aria-label="Search domains"
            placeholder="Search domains"
            className="h-10 w-full rounded-md border border-line bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-muted focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div id={`domains-${activeTab.id}`} role="tabpanel">
        <DomainTable domains={visibleDomains} muted={activeTab.id === "reference"} />
      </div>
    </section>
  );
}

function DomainTable({
  domains,
  muted = false,
}: {
  domains: ExternalDomainSummary[];
  muted?: boolean;
}) {
  if (!domains.length) {
    return (
      <div className="flex items-center gap-3 p-5 text-sm text-muted">
        <Box size={18} aria-hidden="true" />
        No domains found.
      </div>
    );
  }

  return (
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
  );
}

function domainBelongsToTab(domain: ExternalDomainSummary, tabId: DomainTabId) {
  const classification = classifyDomain(domain);

  if (tabId === "all") return true;
  if (tabId === "reference") return classification.reference;
  if (tabId === "assets") return classification.asset;
  if (tabId === "commerce") return classification.commerce;
  if (tabId === "apis") return classification.api;

  return classification.notable;
}

function classifyDomain(domain: ExternalDomainSummary) {
  const value = normalizeDomain(domain.domain);
  const reference = domain.platformReference || isReferenceDomain(value);
  const commerce = !reference && isCommerceDomain(value);
  const api = !reference && isApiOrServiceDomain(value);
  const asset = !reference && isAssetDomain(domain, value);

  return {
    reference,
    commerce,
    api,
    asset,
    notable: !reference && (!asset || api || commerce),
  };
}

function sortDomainsForTab(tabId: DomainTabId, domains: ExternalDomainSummary[]) {
  return [...domains].sort((a, b) => {
    if (tabId === "assets") {
      return compareNumbersDesc(a.externalAssetReferences, b.externalAssetReferences) || compareDefault(a, b);
    }

    if (tabId === "apis") {
      return compareNumbersDesc(a.outboundReferences, b.outboundReferences) || compareDefault(a, b);
    }

    return compareDefault(a, b);
  });
}

function compareDefault(a: ExternalDomainSummary, b: ExternalDomainSummary) {
  return (
    compareNumbersDesc(a.pluginCount, b.pluginCount) ||
    compareNumbersDesc(a.totalReferences, b.totalReferences) ||
    a.domain.localeCompare(b.domain)
  );
}

function compareNumbersDesc(a: number, b: number) {
  return b - a;
}

function isReferenceDomain(domain: string) {
  return (
    matchesDomain(domain, [
      "developer.mozilla.org",
      "developer.wordpress.org",
      "core.trac.wordpress.org",
      "en.wikipedia.org",
      "wikipedia.org",
      "tools.ietf.org",
      "datatracker.ietf.org",
      "ietf.org",
      "php.net",
      "docs.python.org",
      "httpd.apache.org",
      "stackoverflow.com",
      "stackexchange.com",
      "schemas.microsoft.com",
      "schemas.openxmlformats.org",
      "schemas.wp.org",
      "html.spec.whatwg.org",
      "web.archive.org",
      "gist.github.com",
      "developer.apple.com",
      "developers.google.com",
      "support.google.com",
      "support.microsoft.com",
      "groups.google.com",
      "code.google.com",
      "cloud.google.com",
      "docs.google.com",
      "docs.aws.amazon.com",
      "docs.guzzlephp.org",
      "docs.jquery.com",
      "docs.woocommerce.com",
      "api.jquery.com",
      "api.jqueryui.com",
      "docs.newrelic.com",
      "framework.zend.com",
      "pear.php.net",
      "wiki.php.net",
      "curl.haxx.se",
      "bugs.php.net",
      "bugs.webkit.org",
      "bugs.chromium.org",
      "bugs.jquery.com",
      "bugzilla.mozilla.org",
      "developer.paypal.com",
      "platform.openai.com",
      "core.telegram.org",
      "api.slack.com",
      "select2.github.io",
      "redux.js.org",
      "webpack.js.org",
      "svn.apache.org",
      "opensource.org",
      "gnu.org",
    ]) ||
    domain.startsWith("docs.") ||
    domain.startsWith("developer.") ||
    domain.startsWith("developers.") ||
    domain.startsWith("support.") ||
    domain.startsWith("bugs.") ||
    domain.startsWith("wiki.")
  );
}

function isCommerceDomain(domain: string) {
  return matchesDomain(domain, [
    "freemius.com",
    "freemius-local.com",
    "stripe.com",
    "paypal.com",
    "envato.market",
    "paddle.com",
    "fastspring.com",
    "2checkout.com",
    "authorize.net",
    "squareup.com",
    "woocommerce.com",
  ]);
}

function isApiOrServiceDomain(domain: string) {
  return (
    domain.startsWith("api.") ||
    matchesDomain(domain, [
      "googleapis.com",
      "maps.google.com",
      "accounts.google.com",
      "graph.facebook.com",
      "connect.facebook.net",
      "api.whatsapp.com",
      "api.openai.com",
      "nominatim.openstreetmap.org",
      "api.github.com",
      "maker.ifttt.com",
      "api.telegram.org",
      "api.wpclever.net",
      "api.appsero.com",
      "api.bplugins.com",
    ])
  );
}

function isAssetDomain(domain: ExternalDomainSummary, value: string) {
  return (
    matchesDomain(value, [
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      "cdnjs.cloudflare.com",
      "cdn.jsdelivr.net",
      "ajax.googleapis.com",
      "code.jquery.com",
      "maxcdn.bootstrapcdn.com",
      "use.fontawesome.com",
      "player.vimeo.com",
      "img.youtube.com",
      "i.ytimg.com",
      "secure.gravatar.com",
    ]) ||
    (
      domain.externalAssetReferences > 0 &&
      domain.externalAssetReferences >= domain.outboundReferences
    )
  );
}

function matchesDomain(domain: string, bases: string[]) {
  return bases.some((base) => domain === base || domain.endsWith(`.${base}`));
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}
