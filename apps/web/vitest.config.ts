import { defineConfig } from "vitest/config"
import path from "node:path"

// Scoped to pure-function/unit tests only (jurisdiction resolver, jurisdiction config) — no
// component/E2E harness. See lib/jurisdiction and config/jurisdictions __tests__ folders.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
})
