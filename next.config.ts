import type { NextConfig } from "next";

// Set BASE_PATH when hosting under a sub-path, e.g. GitHub Pages project sites
// (BASE_PATH=/llm-cost-calculator). Leave unset for a root domain.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
