import type { PluginSummary } from "@pluginscore/core";
import Image from "next/image";

export function PluginIcon({
  plugin,
  size = "md",
}: {
  plugin: Pick<PluginSummary, "name" | "iconUrl">;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const sizeClass = {
    xs: "size-5",
    sm: "size-9",
    md: "size-11",
    lg: "size-16",
    xl: "size-20",
  }[size];

  const initial = plugin.name.trim().slice(0, 1).toUpperCase() || "P";

  return (
    <div
      className={`${sizeClass} relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-subtle font-mono font-semibold text-muted`}
      aria-hidden="true"
    >
      {plugin.iconUrl ? (
        <Image
          src={plugin.iconUrl}
          alt=""
          fill
          sizes={
            size === "lg"
              ? "64px"
              : size === "xl"
                ? "80px"
              : size === "sm"
                ? "36px"
                : size === "xs"
                  ? "20px"
                  : "44px"
          }
          className="object-cover"
          loading="lazy"
          unoptimized={isPassthroughImage(plugin.iconUrl)}
        />
      ) : (
        initial
      )}
    </div>
  );
}

function isPassthroughImage(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".svg") || pathname.endsWith(".gif");
  } catch {
    return false;
  }
}
