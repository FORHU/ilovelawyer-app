"use client"

import { useParams } from "next/navigation"
import TerminalPopout from "@/components/terminal/terminal-popout"

export default function TerminalWindowPage() {
  const params = useParams<{ caseId: string; panelId: string }>()
  return <TerminalPopout caseId={params.caseId} panelId={params.panelId} />
}
