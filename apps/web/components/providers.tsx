"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { TenantCodeProvider } from "@/components/tenant-code-provider"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { Toaster } from "@workspace/ui/components/sonner"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"
import { useNotificationSocket } from "@/lib/notifications/queries"

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

// Mounted once here (rather than in GlobalHeader, which renders its notification bell twice —
// once for desktop, once inside the always-mounted mobile drawer) so the notification socket
// gets exactly one connection and one set of listeners for the whole app, logged in or not
// (the hook itself no-ops without an access token).
function NotificationSocketBridge() {
  useNotificationSocket()
  return null
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
        <NotificationSocketBridge />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
      <Toaster />
    </GoogleOAuthProvider>
  )
}
