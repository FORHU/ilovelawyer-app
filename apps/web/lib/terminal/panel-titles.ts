import type { PanelId } from "@/lib/terminal/types"

/** The name every Terminal pane is shown under — its header, the pop-out page, the add-pane
 * menu. Its own module (not legal-terminal.tsx, which re-exports it) so the public landing page's
 * panel carousel can show the same names without pulling the whole Terminal into its bundle. */
export const PANEL_TITLES: Record<PanelId, string> = {
  command: "Case Summary",
  evidence: "Evidence & Timeline",
  law: "Law & Precedent",
  dates: "Timeline",
  chat: "AI Legal Assistant",
  mindMap: "Visual Strategy Map",
  redTeam: "Red Team",
  procedure: "Case Strategy",
  legalIssues: "Legal Issues",
  weaknesses: "Weaknesses",
  strengths: "Strengths",
  attackStrategy: "Attack Strategies",
  defenseStrategy: "Defense Strategies",
  witnesses: "Witnesses",
  damages: "Damages & Remedies",
  caseReconstruction: "Case Reconstruction",
  audioOverview: "Audio Overview",
  decisions: "Decisions",
  theories: "Theories",
  trace: "AI Reasoning",
}
