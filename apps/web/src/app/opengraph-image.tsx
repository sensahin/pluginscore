import { defaultOgImage, ogImageSize } from "@/lib/og-image";

export const alt = "PluginScore WordPress plugin scores";
export const size = ogImageSize;
export const contentType = "image/png";
export const runtime = "edge";

export default function Image() {
  return defaultOgImage();
}
