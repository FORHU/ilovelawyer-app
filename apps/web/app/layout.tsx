import type { Metadata } from "next"
import { Geist_Mono, Inter, Libre_Caslon_Text } from "next/font/google"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@workspace/ui/lib/utils";
import { getTenantCodeHint } from "@/lib/tenant-code/get-tenant-code-hint"

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

export const metadata: Metadata = {
  icons: {
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
  },
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
