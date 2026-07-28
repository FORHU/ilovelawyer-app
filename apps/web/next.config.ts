import type { NextConfig } from "next"

// Server-to-server proxy target (read at build/runtime in Node, not sent to the
// browser as-is).
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  allowedDevOrigins: ["192.168.1.29"],
  async rewrites() {
    return [
      { source: "/api/auth/refresh", destination: `${API_URL}/api/auth/refresh` },
      { source: "/api/auth/logout", destination: `${API_URL}/api/auth/logout` },
    ]
  },
}

export default nextConfig
