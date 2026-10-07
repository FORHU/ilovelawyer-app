"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import LegalTerminal from "@/components/terminal/legal-terminal"
import { TerminalDisplayProvider } from "@/components/terminal/terminal-display-provider"
import { useCaseQuery, useMarkCaseOpened } from "@/lib/cases/mutations"
import { CaseUnavailable, isCaseUnavailableError } from "@/components/cases/case-unavailable"
import { SampleTourAutoStart } from "@/components/sample-case/sample-tour-autostart"

export default function TerminalWorkspacePage() {
  const params = useParams<{ caseId: string }>()
  useMarkCaseOpened(params.caseId)
  const { error: caseError } = useCaseQuery(params.caseId)

  if (isCaseUnavailableError(caseError)) {
    return (
      <PageShell>
        <CaseUnavailable />
      </PageShell>
    )
  }

  return (
    <PageShell className="h-screen overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col pt-16">
        <TerminalDisplayProvider>
          <LegalTerminal caseId={params.caseId} />
        </TerminalDisplayProvider>
      </div>
      {/* First visit to any case's Terminal: its tour, on the sample case. */}
      <Suspense>
        <SampleTourAutoStart track="terminal" />
      </Suspense>
    </PageShell>
  )
}
