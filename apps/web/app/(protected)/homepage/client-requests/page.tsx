"use client"

import { useState } from "react"
import { Inbox } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageShell } from "@/components/page-shell"
import { ErrorState } from "@/components/error-state"
import { ClientRequestCard } from "@/components/client-requests/client-request-card"
import { AddCardModal } from "@/components/client-requests/add-card-modal"
import { Pagination } from "@/components/ui/pagination"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { useTenantCodeFeatureGuard } from "@/components/tenant-code-feature-guard"
import {
  isCardRequiredError,
  useClaimClientRequestMutation,
  useClientRequestInboxQuery,
  useClientRequestLiveUpdates,
  usePassClientRequestMutation,
  type ClientRequestInboxView,
} from "@/lib/client-requests/inbox"

const LIMIT = 10
const VIEWS: ClientRequestInboxView[] = ["inbox", "mine", "history"]

function InboxListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientRequestsPage() {
  const { t } = useTranslation("client-requests")

  const guard = useTenantCodeFeatureGuard("clientRequests", {
    eyebrow: t("comingSoon.eyebrow"),
    heading: t("comingSoon.heading"),
    body: (displayName) => t("comingSoon.body", { region: displayName }),
  })

  const [view, setView] = useState<ClientRequestInboxView>("inbox")
  const [page, setPage] = useState(1)
  const [cardModalRequestId, setCardModalRequestId] = useState<string | null>(null)

  const inboxQuery = useClientRequestInboxQuery(view, page, LIMIT)
  const claim = useClaimClientRequestMutation()
  const pass = usePassClientRequestMutation()
  useClientRequestLiveUpdates()
  const showSkeleton = useDelayedLoading(inboxQuery.isLoading)

  if (guard) return guard

  const requests = inboxQuery.data?.data ?? []
  const totalPages = Math.max(1, Math.ceil((inboxQuery.data?.total ?? 0) / LIMIT))

  function handleAccept(id: string) {
    claim.mutate(id, {
      onError: (error) => {
        if (isCardRequiredError(error)) setCardModalRequestId(id)
      },
    })
  }

  function changeView(next: ClientRequestInboxView) {
    setView(next)
    setPage(1)
  }

  return (
    <PageShell>
      <main className="max-w-[800px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-8">
        <div className="w-full flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground">{t("heading")}</h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">{t("subheading")}</p>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-muted p-1 w-fit">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`views.${v}`)}
            </button>
          ))}
        </div>

        {showSkeleton ? (
          <InboxListSkeleton />
        ) : inboxQuery.isError ? (
          <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => inboxQuery.refetch()} />
        ) : requests.length === 0 ? (
          <EmptyState icon={<Inbox />} title={t(`empty.${view}.title`)} description={t(`empty.${view}.description`)} />
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((request) => (
              <ClientRequestCard
                key={request.id}
                request={request}
                view={view}
                onAccept={() => handleAccept(request.id)}
                onPass={() => pass.mutate(request.id)}
                isAccepting={claim.isPending && claim.variables === request.id}
                isPassing={pass.isPending && pass.variables === request.id}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} labels={{ previous: t("pagination.previous"), next: t("pagination.next") }} />
      </main>

      <AddCardModal
        open={cardModalRequestId !== null}
        onClose={() => setCardModalRequestId(null)}
        onCardAdded={() => {
          const id = cardModalRequestId
          setCardModalRequestId(null)
          if (id) claim.mutate(id)
        }}
      />
    </PageShell>
  )
}
