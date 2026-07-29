import fs from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"

// next build doesn't auto-load .env.staging (only recognizes standard names), so
// load it explicitly — it's the one file CI writes NEXT_PUBLIC_* into from secrets.
const stagingEnvPath = path.join(import.meta.dirname, ".env.staging")
if (fs.existsSync(stagingEnvPath)) {
  process.loadEnvFile(stagingEnvPath)
}

// Server-to-server proxy target (read at build/runtime in Node, not sent to the
// browser as-is).
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: ["192.168.1.29"],
  // Next's default gzip compression buffers the whole response before flushing,
  // which breaks the incremental chat streaming proxied through rewrites() below.
  compress: false,
  async rewrites() {
    return [
      { source: "/api/auth/refresh", destination: `${API_URL}/api/auth/refresh` },
      { source: "/api/auth/logout", destination: `${API_URL}/api/auth/logout` },
    ]
  },
}

export default nextConfig
