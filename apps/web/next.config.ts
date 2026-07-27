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
// browser as-is). The browser only ever calls its own origin at /api/*; Next
// forwards those requests here. This keeps frontend and API same-origin from
// the browser's point of view, which is required for the httpOnly, SameSite=Lax
// refreshToken cookie to work when the frontend and backend run on different
// machines/hosts (e.g. frontend on localhost, backend reached via a LAN IP).
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: ["192.168.1.29"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
