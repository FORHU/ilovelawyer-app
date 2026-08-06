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
    // Mirrors lib/fetch.ts's API_PREFIX/versioned() logic exactly (same env var, same six
    // COOKIE_PROXIED_PATHS) — duplicated here since Next's rewrites() runs at config-load time
    // and can't import from lib/fetch.ts. Defaults to unversioned "/api/auth/..." until
    // NEXT_PUBLIC_API_VERSION_PREFIX is set, matching fetch.ts's default so the two never
    // disagree about what path the browser actually calls.
    const prefix = process.env.NEXT_PUBLIC_API_VERSION_PREFIX ?? ""
    const withPrefix = (p: string) => (prefix ? `${prefix}${p.slice("/api".length)}` : p)
    const authPaths = [
      "/api/auth/refresh",
      "/api/auth/logout",
      "/api/auth/login",
      "/api/auth/google",
      "/api/auth/reset-password",
      "/api/auth/verify-otp",
    ]
    return authPaths.map((p) => {
      const versionedPath = withPrefix(p)
      return { source: versionedPath, destination: `${API_URL}${versionedPath}` }
    })
  },
}

export default nextConfig
