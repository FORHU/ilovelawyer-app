import type { MetadataRoute } from "next"
import { headers } from "next/headers"
import { BRAND_ORIGIN } from "@/lib/seo/brand"
import { isBrandApexHost } from "@/lib/tenant-code/resolve-host"
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint"
import { getRequestOrigin } from "@/lib/tenant-code/get-request-origin"

// Builds URLs from the resolved tenant's own Host header — must never be served from a
// cached/static response.
export const dynamic = "force-dynamic"

const DISALLOWED_PATHS = [
  "/homepage", // the entire app/(protected)/homepage/** tree — case portfolio, terminal,
  // document library, statutory codes, calendar, org/profile, and every dynamic
  // [id]/[caseId] route beneath it
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/account-pending",
]

// AI/answer-engine crawlers, explicitly allowed (GEO) so ilovelawyer is eligible to be
// cited in AI-generated answers — e.g. "best AI legal software for Philippine lawyers".
// Flip an individual entry to `disallow: "/"` in its own rule to opt that one out.
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [tenantCode, origin, headersList] = await Promise.all([getTenantCodeHint(), getRequestOrigin(), headers()])
  const isApex = tenantCode === null && isBrandApexHost(headersList.get("host"))

  if (tenantCode === null && !isApex) {
    // Other unrecognized hosts (app.ilovelawyer.com): just the neutral splash, nothing to
    // rank. Disallow everything and don't advertise a sitemap.
    return { rules: { userAgent: "*", disallow: "/" } }
  }

  // Tenants and the brand apex (an indexable hub: brand entity + links to both jurisdictions,
  // so searches for "ilovelawyer" can land on a domain Google is allowed to crawl).
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: AI_CRAWLER_USER_AGENTS,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    // The apex always advertises the canonical origin, matching sitemap.ts (so `www.` doesn't
    // point at a different sitemap URL).
    sitemap: `${isApex ? BRAND_ORIGIN : origin}/sitemap.xml`,
  }
}
