"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { TenantCodeProvider } from "@/components/tenant-code-provider"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
      mutations: {
        throwOnError: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({
  children,
  tenantCodeHint,
}: {
  children: React.ReactNode
  tenantCodeHint: TenantCode | null
}) {
  const queryClient = getQueryClient()

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <TenantCodeProvider tenantCode={tenantCodeHint}>
              <TooltipProvider>{children}</TooltipProvider>
            </TenantCodeProvider>
          </I18nProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  )
}
