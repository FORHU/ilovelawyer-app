import fs from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"
import { AUTH_PATHS, versioned } from "./lib/api-version"

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
  // Pin the workspace root to this pnpm workspace so Turbopack doesn't infer it
  // from the unrelated package-lock.json at the parent forhu-project/ directory.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  // Next's default gzip compression buffers the whole response before flushing,
  // which breaks the incremental chat streaming proxied through rewrites() below.
  compress: false,
  async rewrites() {
    return AUTH_PATHS.map((p) => {
      const versionedPath = versioned(p)
      return { source: versionedPath, destination: `${API_URL}${versionedPath}` }
    })
  },
}

export default nextConfig
