import { AppShell } from "@/components/app-shell";
import { DomainBrowser } from "@/components/domain-browser";
import { getExternalDomains } from "@/lib/api";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "External Domains in WordPress Plugins",
  description:
    "Browse external domains referenced by WordPress plugins in PluginScore static code analysis, including outbound calls, external assets, and plugin counts.",
  path: "/domains",
});

export const revalidate = 1_800;

export default async function DomainsPage() {
  const domains = await getExternalDomains(200);

  return (
    <AppShell>
      <section className="rounded-md border border-line bg-surface p-5">
        <h1 className="text-3xl font-semibold tracking-normal">External Domains</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Potential external domains found by static code analysis.
        </p>
      </section>

      <DomainBrowser domains={domains} />
    </AppShell>
  );
}
