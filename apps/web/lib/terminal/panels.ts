import { PANEL_IDS, type PanelId } from "@/lib/terminal/types"

export const HIDDEN_PANELS = new Set<PanelId>(["redTeam", "dates"])

export const PANEL_TITLES: Record<PanelId, string> = {
  command: "Case Summary",
  evidence: "Evidence & Timeline",
  law: "Law & Precedent",
  dates: "Timeline",
  chat: "AI Legal Assistant",
  mindMap: "Visual Strategy Map",
  redTeam: "Red Team",
  procedure: "Case Strategy",
  risk: "Risk Analysis",
  teamAudit: "Team & Audit",
}

export function isPanelId(value: unknown): value is PanelId {
  return typeof value === "string" && (PANEL_IDS as readonly string[]).includes(value)
}

export function terminalWindowPath(caseId: string, panelId: PanelId) {
  return `/homepage/terminal/${caseId}/window/${panelId}`
}

export function openTerminalWindow(caseId: string, panelId: PanelId) {
  const safeCase = caseId.replace(/[^a-zA-Z0-9_-]/g, "")
  const name = `illterm_${safeCase}_${panelId}`
  return window.open(
    terminalWindowPath(caseId, panelId),
    name,
    "popup=yes,width=880,height=680,menubar=no,toolbar=no,location=no,status=no",
  )
}
