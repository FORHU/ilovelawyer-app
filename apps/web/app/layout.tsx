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
