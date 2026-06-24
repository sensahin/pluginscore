import { AppShell } from "@/components/app-shell";
import { seoMetadata } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "About PluginScore",
  description:
    "A personal note from Senol Sahin about PluginScore, an open source WordPress plugin audit and discovery project.",
  path: "/about",
  absoluteTitle: true,
});

export const revalidate = 1_800;

export default function AboutPage() {
  return (
    <AppShell>
      <article className="rounded-md border border-line bg-surface p-5 md:p-6">
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal">
          About PluginScore
        </h1>

        <div className="mt-4 max-w-3xl space-y-4 text-sm leading-7 text-muted">
          <p>
            Hi, my name is Senol. I love the WordPress ecosystem so much that I
            keep building tools around it.
          </p>
          <p>
            PluginScore was born out of my curiosity to understand plugins more
            deeply: their scan results, external calls, authors, maintenance,
            performance, history, and overall quality signals.
          </p>
          <p>
            It audits WordPress plugins with the official WordPress Plugin Check,
            shows possible external domain calls, and brings useful stats,
            rankings, graphs, and badges together in one place.
          </p>
          <p>
            PluginScore is open source, and contributions are welcome at{" "}
            <a
              href="https://github.com/sensahin/pluginscore"
              className="text-info hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              sensahin/pluginscore
            </a>
            . You can also see my other work at{" "}
            <a
              href="https://pufferworks.com"
              className="text-info hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              pufferworks.com
            </a>
            .
          </p>
        </div>
      </article>
    </AppShell>
  );
}
