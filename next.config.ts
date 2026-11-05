import type { NextConfig } from "next";
const development = process.env.NODE_ENV === "development";
const config: NextConfig = {
  ...(development
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:8787/api/:path*",
            },
          ];
        },
      }
    : { output: "export" }),
  poweredByHeader: false,
  agentRules: false,
  reactStrictMode: true,
  images: { unoptimized: true },
};
export default config;
