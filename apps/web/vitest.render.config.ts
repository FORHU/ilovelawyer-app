// Throwaway: lets vitest parse .tsx so one component can be rendered. Not the repo's test config.
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node", include: ["components/chat/__tests__/citation-rank-render.spec.ts"] },
})
