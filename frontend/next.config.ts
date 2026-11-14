import type { NextConfig } from "next";

/**
 * The browser talks to the backend through a same-origin proxy: `/api/*` is
 * rewritten to the backend origin. This avoids CORS configuration entirely
 * (the backend's allowlist targets `http://localhost:5173`, not :3000) and
 * keeps `X-User` / `Idempotency-Key` headers flowing through untouched.
 *
 * Override the target with BACKEND_ORIGIN, e.g.:
 *   BACKEND_ORIGIN=http://127.0.0.1:9999 npm run dev   # against scripts/mock-backend.mjs
 */
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendOrigin}/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
