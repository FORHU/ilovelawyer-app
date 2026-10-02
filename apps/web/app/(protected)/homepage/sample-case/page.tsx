"use client"

import { Suspense } from "react"
import { PageShell } from "@/components/page-shell"
import { SampleCaseView } from "@/components/sample-case/sample-case-view"

export default function SampleCasePage() {
  return (
    <PageShell activeTab="case-portfolio">
      {/* SampleCaseView reads ?view=, ?tour= and ?from= — see useSearchParams in the Next docs. */}
      <Suspense>
        <SampleCaseView />
      </Suspense>
    </PageShell>
  )
}
