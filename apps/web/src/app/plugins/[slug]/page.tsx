import type { Metadata } from "next";
import { getPlugin, getPluginScoreHistory } from "@/lib/api";
import { formatSlugTitle } from "@/lib/formatting";
import { plugins } from "@/lib/plugin-score-data";
import { pluginScoreTitle, seoMetadata } from "@/lib/seo";
import { MissingPluginPage, PluginPageView } from "./plugin-page-view";

type PluginPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 1_800;

export function generateStaticParams() {
  return plugins.map((plugin) => ({ slug: plugin.slug }));
}

export async function generateMetadata({
  params,
}: PluginPageProps): Promise<Metadata> {
  const { slug } = await params;
  const plugin = await getPlugin(slug);

  if (!plugin) {
    const displayName = formatSlugTitle(slug);
    return {
      ...seoMetadata({
        title: `${displayName} Plugin Score`,
        description: `Check whether ${displayName} exists on WordPress.org and submit it for a PluginScore scan.`,
        path: `/plugins/${encodeURIComponent(slug)}`,
      }),
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const title = pluginScoreTitle(plugin.name);
  const description = plugin.audited === false
    ? `${plugin.name} PluginScore scan is queued or pending. Review WordPress.org metadata, tags, installs, and author details while the audit runs.`
    : `${plugin.name} score: ${plugin.score}/100, ${plugin.errors.toLocaleString()} errors, ${plugin.warnings.toLocaleString()} warnings. Review Plugin Check findings, category scores, tags, installs, and author metadata.`;
  const metadata = seoMetadata({
    title,
    description,
    path: `/plugins/${encodeURIComponent(plugin.slug)}`,
  });

  return {
    ...metadata,
    keywords: [
      plugin.name,
      `${plugin.name} score`,
      `${plugin.name} plugin`,
      "WordPress plugin score",
      "Plugin Check",
      ...(plugin.tags ?? []).map((tag) => tag.name),
    ],
  };
}

export default async function PluginPage({ params }: PluginPageProps) {
  const { slug } = await params;
  const [plugin, scoreHistory] = await Promise.all([
    getPlugin(slug),
    getPluginScoreHistory(slug),
  ]);

  if (!plugin) {
    return <MissingPluginPage slug={slug} />;
  }

  return (
    <PluginPageView
      plugin={plugin}
      history={scoreHistory?.history ?? []}
    />
  );
}
