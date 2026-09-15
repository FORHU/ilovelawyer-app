import { BookOpen, Scale, Workflow, TriangleAlert, Users, type LucideIcon } from "lucide-react"
import type { PanelId } from "@/lib/terminal/types"

export type PaneCategory = "facts" | "law" | "strategy" | "risk" | "team"

export const PANE_CATEGORY_ORDER: PaneCategory[] = ["facts", "law", "strategy", "risk", "team"]

export const PANE_CATEGORY_META: Record<PaneCategory, { labelKey: string; icon: LucideIcon }> = {
  facts: { labelKey: "categoryFacts", icon: BookOpen },
  law: { labelKey: "categoryLaw", icon: Scale },
  strategy: { labelKey: "categoryStrategy", icon: Workflow },
  risk: { labelKey: "categoryRisk", icon: TriangleAlert },
  team: { labelKey: "categoryTeam", icon: Users },
}

// Frontend-only display grouping — purely presentational, independent of the backend
// catalog's `phase`/sku fields.
export const PANEL_CATEGORY: Partial<Record<PanelId, PaneCategory>> = {
  command: "facts",
  evidence: "facts",
  contradictions: "facts",
  witnesses: "facts",
  caseReconstruction: "facts",
  law: "law",
  citationMap: "law",
  legalIssues: "law",
  procedure: "strategy",
  mindMap: "strategy",
  attackStrategy: "strategy",
  defenseStrategy: "strategy",
  audioOverview: "strategy",
  theories: "strategy",
  decisions: "strategy",
  redTeam: "risk",
  weaknesses: "risk",
  strengths: "risk",
  damages: "risk",
  teamAudit: "team",
  chat: "team",
}
