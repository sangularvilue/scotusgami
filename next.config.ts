import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the game reads data/pool.json server-side; make sure it ships with the
  // serverless functions that need it
  outputFileTracingIncludes: {
    "/game": ["./data/pool.json"],
    "/api/game/**": ["./data/pool.json"],
  },
};

export default nextConfig;
