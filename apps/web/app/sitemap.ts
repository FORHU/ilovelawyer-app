import type { MetadataRoute } from "next"
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint"
import { getRequestOrigin } from "@/lib/tenant-code/get-request-origin"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tenantCode, origin] = await Promise.all([getTenantCodeHint(), getRequestOrigin()])

  // Apex/unresolved host: nothing indexable to list (see robots.ts, which disallows
  // everything on this host anyway).
  if (tenantCode === null) return []

  return [
    {
      url: `${origin}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
