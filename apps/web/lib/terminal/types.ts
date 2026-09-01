export const PANEL_IDS = [
  "command",
  "evidence",
  "law",
  "dates",
  "chat",
  "mindMap",
  "redTeam",
  "procedure",
  "teamAudit",
  "contradictions",
  "legalIssues",
  "weaknesses",
  "strengths",
  "attackStrategy",
  "defenseStrategy",
  "witnesses",
  "damages",
  "caseReconstruction",
  "audioOverview",
] as const

export type PanelId = (typeof PANEL_IDS)[number]
export type PresetValue = "PANE_1" | "PANE_2" | "PANE_4" | "PANE_6"

export interface PanelLayout {
  id: PanelId
  visible: boolean
  order: number
  width: number
  height: number
  x?: number
  y?: number
}

export interface WorkspaceLayout {
  preset: PresetValue
  panels: PanelLayout[]
}

export interface PanelCatalogEntry {
  id: PanelId
  label: string
  phase: string
  defaultHidden: boolean
  minSku: "SOLO" | "PROFESSIONAL" | "ENTERPRISE"
  description: string
  available: boolean
}

export interface TerminalCatalog {
  panels: PanelCatalogEntry[]
  presets: PresetValue[]
  defaultPreset: PresetValue
}

export interface TerminalWorkspace {
  id: string
  userId: string
  name: string
  preset: PresetValue
  layoutJson: WorkspaceLayout
  isLastUsed: boolean
  createdAt: string
  updatedAt: string
}

export interface SnapshotDocument {
  id: string
  name: string
  ragStatus: string | null
  documentType: string | null
  mimeType: string | null
  pageCount: number | null
  extractionMethod: string | null
  language: string | null
  createdAt: string
}

export interface SnapshotTimelineEvent {
  id: string
  title: string
  occurredOn: string | null
  description: string | null
  status: string
  source: "AI" | "LAWYER" | "CALENDAR"
  pageNumber: number | null
}

export interface SnapshotRisk {
  id: string
  title: string
  description: string | null
  severity: "FATAL" | "MAJOR" | "UNVERIFIED" | "MISSING_EVIDENCE" | "DEADLINE"
  status: "OPEN" | "CONFIRMED" | "ACCEPTED"
  pageNumber: number | null
}

export interface SnapshotDate {
  id: string
  title: string
  dateTime: string
  type: string | null
  source: string
  status: string | null
}

export interface SnapshotContradiction {
  id: string
  kind: string
  leftExcerpt: string
  rightExcerpt: string
  factKey: string
  leftValue: string
  rightValue: string
  confidence: number
}

export interface SnapshotCitation {
  id: string
  quotedText: string
  citedReference: string | null
  status: "VALID" | "INVALID" | "UNVERIFIED" | "ADVERSE"
  notes: string | null
}

export interface SnapshotDeadlineConfirmation {
  id: string
  userId: string
  confirmed: boolean
  note: string | null
}

export interface SnapshotDeadline {
  id: string
  label: string
  ruleCode: string
  triggerDate: string
  computedDueDate: string
  ruleSource: string
  calculationNotes: string
  confirmations?: SnapshotDeadlineConfirmation[]
}

export interface SnapshotProcedureItem {
  id: string
  kind: string
  label: string
  done: boolean
  notes: string | null
}

export interface SnapshotAuditEvent {
  id: string
  action: string
  createdAt: string
  actorId?: string | null
}

export interface SnapshotStaleness {
  nodeType: "TIMELINE_EVENT" | "PROCEDURAL_DEADLINE"
  refId: string
  staleReason: string
  staleAt: string
}

export interface CaseSnapshot {
  case: {
    id: string
    caseName: string
    actionType?: string | null
    jurisdiction?: string | null
    parties: { id: string; name: string; designation: string }[]
    lastRefreshedAt: string | null
  }
  documents: SnapshotDocument[]
  timeline: SnapshotTimelineEvent[]
  risks: SnapshotRisk[]
  dates: SnapshotDate[]
  nextDate: SnapshotDate | SnapshotTimelineEvent | null
  fatalRisks: SnapshotRisk[]
  evidence: { matrix: unknown[]; contradictions: SnapshotContradiction[] }
  law: { citations: SnapshotCitation[] }
  procedure: { deadlines: SnapshotDeadline[]; items: SnapshotProcedureItem[]; requiredConfirmations: number }
  teamAudit: { accesses: unknown[]; audit: SnapshotAuditEvent[] }
  findings: CaseFinding[]
  witnesses: Witness[]
  damages: DamageClaim[]
  reconstruction: CaseReconstruction | null
  redTeamAssessment: RedTeamAssessment | null
  staleness: SnapshotStaleness[]
  riskAnalysis?: {
    overall: { score: number; level: "HIGH" | "MEDIUM" | "LOW"; drivers: { code: string; count: number }[] }
    liability: { score: number; level: "HIGH" | "MEDIUM" | "LOW"; drivers: { code: string; count: number }[] }
  }
  lastRefreshedAt: string | null
}

export type FindingCategory = "LEGAL_ISSUE" | "WEAKNESS" | "STRENGTH" | "ATTACK_STRATEGY" | "DEFENSE_STRATEGY"

export interface CaseFinding {
  id: string
  caseId: string
  category: FindingCategory
  label: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Witness {
  id: string
  caseId: string
  name: string
  role: string | null
  contact: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type DamageCategory = "ACTUAL" | "MORAL" | "EXEMPLARY" | "ATTORNEYS_FEES" | "OTHER"

export interface DamageClaim {
  id: string
  caseId: string
  category: DamageCategory
  description: string | null
  amount: number | null
  createdAt: string
  updatedAt: string
}

export interface CaseReconstruction {
  id: string
  caseId: string
  narrative: string
  narrativeCourt: string | null
  narrativeOpposing: string | null
  gaps: string[]
  audioFileId: string | null
  audioFile: { id: string; fileUrl: string | null } | null
  audioStatus: string | null
  audioStaleAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RedTeamAssessment {
  id: string
  caseId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface DeadlineRule {
  code: string
  label: string
  days: number
  ruleSource: string
}
