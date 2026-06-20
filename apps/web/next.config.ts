import type { NextConfig } from "next";

const publicPageCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
  },
];

const longLivedPublicCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  },
];

const shortApiCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@pluginscore/core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ps.w.org",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/about",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/authors",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/authors/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/categories/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/compare",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/compare/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/issues",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/issues/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/methodology",
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/plugins/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/rankings",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/rankings/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/tags",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/tags/:path*",
        headers: publicPageCacheHeaders,
      },
      {
        source: "/sitemap.xml",
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/api/plugins/search",
        headers: shortApiCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
