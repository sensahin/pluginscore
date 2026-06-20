import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/search"],
        crawlDelay: 10,
      },
    ],
    sitemap: "https://pluginscore.com/sitemap.xml",
  };
}
