import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs (under pdf-parse) loads its worker and the native canvas polyfill at
  // runtime; keep both out of the bundle so the refresh cron can parse the
  // Granted & Noted list (pdf-parse's documented Next.js + Vercel setup)
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // the game reads data/pool.json server-side; make sure it ships with the
  // serverless functions that need it
  outputFileTracingIncludes: {
    "/game": ["./data/pool.json"],
    "/api/game/**": ["./data/pool.json"],
    "/bingo": ["./data/bingo-*.json"],
    // the platform-specific canvas binary is required dynamically, so the
    // tracer misses it
    "/api/refresh": ["./node_modules/@napi-rs/canvas*/**"],
  },
};

export default nextConfig;
