import { defineConfig } from "vitest/config"
import path from "node:path"

// Scoped to pure-function/unit tests only (tenant-code resolver, tenant-code config) — no
// component/E2E harness. See lib/tenant-code and config/tenant-codes __tests__ folders.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  // multi-screen.ts imports a constant from a .tsx module, so tests touching it need JSX parsed.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
})
