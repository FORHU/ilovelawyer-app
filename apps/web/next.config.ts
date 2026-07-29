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
  async rewrites() {
    // These all set the refreshToken httpOnly cookie, so they must be proxied
    // same-origin — otherwise the cookie ends up scoped to the API's own
    // domain instead of the frontend's, and never gets sent back on reload.
    const COOKIE_SETTING_AUTH_PATHS = ["login", "google", "verify-otp", "reset-password", "refresh", "logout"]
    return COOKIE_SETTING_AUTH_PATHS.map((path) => ({
      source: `/api/auth/${path}`,
      destination: `${API_URL}/api/auth/${path}`,
    }))
  },
}

export default nextConfig
