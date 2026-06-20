import type { NextConfig } from "next";

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
};

export default nextConfig;
