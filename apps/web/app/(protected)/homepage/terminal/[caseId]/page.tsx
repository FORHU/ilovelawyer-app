"use client"

import { useParams } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import LegalTerminal from "@/components/terminal/legal-terminal"
import { TerminalDisplayProvider } from "@/components/terminal/terminal-display-provider"

export default function TerminalWorkspacePage() {
  const params = useParams<{ caseId: string }>()

  return (
    <PageShell activeTab="terminal" className="h-screen overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col pt-16">
        <TerminalDisplayProvider>
          <LegalTerminal caseId={params.caseId} />
        </TerminalDisplayProvider>
      </div>
    </PageShell>
  )
}
