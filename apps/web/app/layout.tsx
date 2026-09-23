import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter, Libre_Caslon_Text } from "next/font/google"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@workspace/ui/lib/utils";
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint"
import { getRequestOrigin } from "@/lib/tenant-code/get-request-origin"

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const libreCaslonText = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
})

// Fallback origin for metadataBase when the Host header doesn't resolve to a known tenant
// (bare apex, app.ilovelawyer.com, or a missing/malformed Host on a raw/probe request).
// metadataBase resolves the relative favicon URLs below into absolute <link> tags — trusting
// an unvalidated Host here would let a spoofed or missing Host header (a) throw on
// `new URL("https://")` when Host is empty, breaking every route via this root layout, or
// (b) point those favicon links at an attacker-controlled domain if something downstream ever
// caches a response without varying on Host. A fixed, always-valid default closes both.
const FALLBACK_ORIGIN = "https://ilovelawyer.com"

export async function generateMetadata(): Promise<Metadata> {
  const [tenantCode, origin] = await Promise.all([getTenantCodeHint(), getRequestOrigin()])

  return {
    metadataBase: new URL(tenantCode === null ? FALLBACK_ORIGIN : origin),
    title: {
      default: "ilovelawyer — Legal Intelligence Platform",
      template: "%s · ilovelawyer",
    },
    description: "AI-native case management, legal research, and drafting built for practicing lawyers.",
    // Default-deny: every route that doesn't explicitly opt back in (only app/page.tsx does)
    // stays unindexed — this is also the only lever available for app/(auth)/** and
    // app/(protected)/**, since those are all "use client" and can't export their own metadata.
    robots: { index: false, follow: false },
    icons: metadataIcons,
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14161c" },
  ],
}

const metadataIcons: Metadata["icons"] = {
  // Default (no media) first: Chrome often ignores prefers-color-scheme on
  // favicons and takes the first matching size — a solid dark plate + white
  // mark stays readable on both light and dark browser chrome.
  icon: [
    { url: "/favicon/favicon-16.png?v=3", sizes: "16x16", type: "image/png" },
    { url: "/favicon/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
    {
      url: "/favicon/favicon-16-light.png?v=3",
      sizes: "16x16",
      type: "image/png",
      media: "(prefers-color-scheme: light)",
    },
    {
      url: "/favicon/favicon-16-dark.png?v=3",
      sizes: "16x16",
      type: "image/png",
      media: "(prefers-color-scheme: dark)",
    },
    {
      url: "/favicon/favicon-32-light.png?v=3",
      sizes: "32x32",
      type: "image/png",
      media: "(prefers-color-scheme: light)",
    },
    {
      url: "/favicon/favicon-32-dark.png?v=3",
      sizes: "32x32",
      type: "image/png",
      media: "(prefers-color-scheme: dark)",
    },
    {
      url: "/favicon/favicon-512-light.png?v=3",
      sizes: "512x512",
      type: "image/png",
      media: "(prefers-color-scheme: light)",
    },
    {
      url: "/favicon/favicon-512-dark.png?v=3",
      sizes: "512x512",
      type: "image/png",
      media: "(prefers-color-scheme: dark)",
    },
  ],
  apple: [
    {
      url: "/favicon/favicon-180-light.png?v=3",
      sizes: "180x180",
      type: "image/png",
      media: "(prefers-color-scheme: light)",
    },
    {
      url: "/favicon/favicon-180-dark.png?v=3",
      sizes: "180x180",
      type: "image/png",
      media: "(prefers-color-scheme: dark)",
    },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const tenantCodeHint = await getTenantCodeHint()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable, libreCaslonText.variable)}
    >
      <body suppressHydrationWarning>
        <Providers tenantCodeHint={tenantCodeHint}>{children}</Providers>
      </body>
    </html>
  )
}
