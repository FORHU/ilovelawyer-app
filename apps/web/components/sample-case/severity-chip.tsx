import type { ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import type { Severity } from "@/lib/sample-case/data"

const TONE = { high: "danger", med: "warning", low: "success", neutral: "neutral" } as const satisfies Record<Severity, string>

/** A sample pane's status chip: the shared Badge in its square Terminal shape. */
export function SeverityChip({ sev, children }: { sev: Severity; children: ReactNode }) {
  return <Badge tone={TONE[sev]}>{children}</Badge>
}
