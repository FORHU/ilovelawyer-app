"use client"

import { useParams } from "next/navigation"
import GlobalHeader from "@/components/global-header"
import LegalTerminal from "@/components/terminal/legal-terminal"

export default function TerminalWorkspacePage() {
  const params = useParams<{ caseId: string }>()

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <GlobalHeader activeTab="terminal" />
      <div className="flex min-h-0 flex-1 flex-col pt-14">
        <LegalTerminal caseId={params.caseId} />
      </div>
    </div>
  )
}
