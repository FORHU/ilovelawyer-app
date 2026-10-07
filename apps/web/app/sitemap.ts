import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint"
import { BRAND_ORIGIN } from "@/lib/seo/brand"
import { isBrandApexHost } from "@/lib/tenant-code/resolve-host"
import { getRequestOrigin } from "@/lib/tenant-code/get-request-origin"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tenantCode, origin, headersList] = await Promise.all([getTenantCodeHint(), getRequestOrigin(), headers()])

  if (tenantCode === null) {
    // The brand apex is an indexable hub; any other unresolved host (app.) has nothing to list.
    if (!isBrandApexHost(headersList.get("host"))) return []
    return [{ url: `${BRAND_ORIGIN}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }]
  }

  return [
    {
      url: `${origin}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // Not an HTML page — listed so crawlers that discover URLs via the sitemap (rather
      // than only checking well-known paths like robots.txt) also find this one. See
      // public/llms.txt.
      url: `${origin}/llms.txt`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.1,
    },
  ]
}
