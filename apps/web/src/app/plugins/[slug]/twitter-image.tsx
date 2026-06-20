import { getPlugin } from "@/lib/api";
import { defaultOgImage, ogImageSize, pluginToOgImage } from "@/lib/og-image";

type PluginImageProps = {
  params: Promise<{ slug: string }>;
};

export const alt = "PluginScore plugin score card";
export const size = ogImageSize;
export const contentType = "image/png";
export const runtime = "edge";

export default async function Image({ params }: PluginImageProps) {
  const { slug } = await params;
  const plugin = await getPlugin(slug);

  return plugin ? pluginToOgImage(plugin) : defaultOgImage();
}
