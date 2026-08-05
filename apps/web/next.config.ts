import type { NextConfig } from "next";

const publicPageCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=21600, stale-while-revalidate=604800",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=21600, stale-while-revalidate=604800",
  },
];

const stablePublicCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=43200, stale-while-revalidate=604800",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=43200, stale-while-revalidate=604800",
  },
];

const longLivedPublicCacheHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
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
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/authors",
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/authors/:path*",
        headers: stablePublicCacheHeaders,
      },
      {
        source: "/categories/:path*",
        headers: stablePublicCacheHeaders,
      },
      {
        source: "/compare",
        headers: stablePublicCacheHeaders,
      },
      {
        source: "/compare/:path*",
        headers: stablePublicCacheHeaders,
      },
      {
        source: "/domains",
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/domains/:path*",
        headers: stablePublicCacheHeaders,
      },
      {
        source: "/issues",
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/issues/:path*",
        headers: stablePublicCacheHeaders,
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
        headers: longLivedPublicCacheHeaders,
      },
      {
        source: "/tags/:path*",
        headers: stablePublicCacheHeaders,
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
  async redirects() {
    return [
      {
        source: "/plugins/:slug/rule/:code",
        destination: "/issues/:code",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.pluginscore.com",
          },
        ],
        destination: "https://pluginscore.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
