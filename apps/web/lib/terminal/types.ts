export const PANEL_IDS = [
  "command",
  "evidence",
  "law",
  "dates",
  "chat",
  "mindMap",
  "citationMap",
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
  "decisions",
  "theories",
  "verification",
] as const

export type PanelId = (typeof PANEL_IDS)[number]
export type PresetValue = "PANE_1" | "PANE_2" | "PANE_4" | "PANE_6"
export const ARRANGEMENT_VALUES = ["free", "columns", "tabs", "focus"] as const
export type ArrangementValue = (typeof ARRANGEMENT_VALUES)[number]

export interface PanelLayout {
  id: PanelId
  visible: boolean
  order: number
  width: number
  height: number
  x?: number
  y?: number
  /** Columns mode only: which column (0-based) this pane is stacked in. */
  columnIndex?: number
  /** Tabs mode only: which of the 2 groups this pane's tab lives in. Defaults to 0 when absent. */
  tabGroup?: number
  /** Protects this pane's own slot: no move/resize in Free, no reassignment/replace in
   * Columns/Tabs. Never disables a divider shared with a neighboring, unpinned pane — see
   * PaneHeaderActions' pin handling in legal-terminal.tsx. No-op in Focus mode. */
  pinned?: boolean
}

export interface WorkspaceLayout {
  preset: PresetValue
  /** Optional — absent on workspaces saved before arrangement modes existed, treated as "free". */
  arrangement?: ArrangementValue
  panels: PanelLayout[]
  /** Columns mode: how many columns (2-4) and their widths as fractions summing to 1. */
  columnCount?: number
  columnWidths?: number[]
  /** Tabs mode: the 2 groups' width split (fraction for group A, 0-1) and each group's
   * persisted active tab. */
  tabsSplit?: number
  tabsActiveA?: PanelId
  tabsActiveB?: PanelId
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
  // Null on any workspace saved before case-scoping existed — those are never returned by the
  // now case-scoped list query, so in practice every row this app ever reads back has one.
  caseId: string | null
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
  // Same field the Workspace document browser groups into "folders" from (DocumentFolderBrowser)
  // — null/empty means the document isn't in any folder there.
  category: string | null
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
  documentId: string | null
  pageNumber: number | null
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH"
export type OutlookBand =
  | "UNFAVORABLE"
  | "LEANS_UNFAVORABLE"
  | "UNCERTAIN"
  | "LEANS_FAVORABLE"
  | "FAVORABLE"

// LLM judgement of how the case is going, as a band + confidence, never a number. Null until the
// case's first refresh after the outlook feature shipped.
export interface CaseOutlook {
  band: OutlookBand
  confidence: ConfidenceLevel
  rationale: string
  drivers: { label: string; direction: "FOR" | "AGAINST"; sourceDocId?: string | null }[]
  createdAt: string
}

// Weekly buckets, oldest first — matches ilovelawyer-api's WeeklyTrendPoint (swagger.ts) exactly:
// `total` is the running total as of that week, `added` is just that week's new items.
export interface TrendPoint {
  weekStart: string
  added: number
  total: number
}

export interface SnapshotRisk {
  id: string
  title: string
  description: string | null
  severity: "FATAL" | "MAJOR" | "UNVERIFIED" | "MISSING_EVIDENCE" | "DEADLINE"
  status: "OPEN" | "CONFIRMED" | "ACCEPTED"
  pageNumber: number | null
  /** Null for lawyer-added risks; only AI-generated risks carry a confidence. */
  confidence?: ConfidenceLevel | null
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

export type PrivilegeStatus = "NONE" | "ATTORNEY_CLIENT" | "WORK_PRODUCT"
export type HearsayCategory =
  | "DIRECT_EVIDENCE"
  | "BUSINESS_RECORD"
  | "PRESENT_SENSE_IMPRESSION"
  | "EXCITED_UTTERANCE"
  | "OTHER_EXCEPTION"
  | "NOT_APPLICABLE"

export interface SnapshotCustodyEvent {
  id: string
  custodianName: string
  action: string
  occurredAt: string
  notes: string | null
  createdAt: string
}

export interface SnapshotEvidenceMatrixItem {
  id: string
  caseId: string
  documentId: string
  authenticity: string
  admissibility: string
  probative: string
  originalFile: boolean
  needsVerify: boolean
  notes: string | null
  privilegeStatus: PrivilegeStatus
  hearsayCategory: HearsayCategory
  sponsoringWitnessId: string | null
  custodyEvents: SnapshotCustodyEvent[]
  createdAt: string
  updatedAt: string
}

export interface SnapshotCitation {
  id: string
  quotedText: string
  citedReference: string | null
  status: "VALID" | "INVALID" | "UNVERIFIED" | "ADVERSE"
  notes: string | null
  /** Separate from `status` (does the quote match the source): does the cited authority itself
   * exist? Null means either no citedReference was given, or it didn't resolve — same engine
   * Citation Map uses (LawSvc.search for PH, the UK Legal MCP for UK). */
  resolvedAuthority: { lawId: string; title: string; jurisUrl: string } | null
  /** Page/paragraph reference, e.g. "p. 15" or "para. 4". Lawyer-entered, or auto-detected for a
   * resolved UK judgment by searching its actual text for the quote (never a guess). */
  pinpoint: string | null
  /** How quotedText relates to officialText. Null when there's no officialText to classify
   * against, or classification failed. */
  propositionType: "QUOTED" | "PARAPHRASED" | "INFERRED" | null
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
  /** Which source document an AI-generated item is grounded in. Null for lawyer-entered items
   * and for AI items the model didn't attribute to a specific document. */
  sourceLabel: string | null
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

export interface SnapshotMindMapStatus {
  lastGeneratedAt: string | null
  isStale: boolean
}

export interface CaseSnapshot {
  case: {
    id: string
    caseName: string
    actionType?: string | null
    jurisdiction?: string | null
    parties: { id: string; name: string; designation: string; descriptor?: string | null }[]
    lastRefreshedAt: string | null
  }
  documents: SnapshotDocument[]
  timeline: SnapshotTimelineEvent[]
  risks: SnapshotRisk[]
  dates: SnapshotDate[]
  nextDate: SnapshotDate | SnapshotTimelineEvent | null
  fatalRisks: SnapshotRisk[]
  evidence: {
    matrix: SnapshotEvidenceMatrixItem[]
    contradictions: SnapshotContradiction[]
  }
  law: { citations: SnapshotCitation[] }
  procedure: {
    deadlines: SnapshotDeadline[]
    items: SnapshotProcedureItem[]
    requiredConfirmations: number
  }
  teamAudit: { accesses: unknown[]; audit: SnapshotAuditEvent[] }
  findings: CaseFinding[]
  witnesses: Witness[]
  damages: DamageClaim[]
  reconstruction: CaseReconstruction | null
  redTeamAssessment: RedTeamAssessment | null
  decisions: DecisionRecord[]
  theories: CaseTheory[]
  annotations: Annotation[]
  staleness: SnapshotStaleness[]
  mindMap: SnapshotMindMapStatus
  /** `outlookHistory` is newest first and includes the current one. */
  outlook?: CaseOutlook | null
  outlookHistory?: { band: OutlookBand; confidence: ConfidenceLevel; createdAt: string }[]
  trends?: { health?: TrendPoint[]; openIssues?: TrendPoint[]; evidence?: TrendPoint[] }
  riskAnalysis?: {
    overall: {
      score: number
      level: "HIGH" | "MEDIUM" | "LOW"
      drivers: { code: string; count: number }[]
    }
    liability: {
      score: number
      level: "HIGH" | "MEDIUM" | "LOW"
      drivers: { code: string; count: number }[]
    }
  }
  lastRefreshedAt: string | null
}

export type FindingCategory =
  | "LEGAL_ISSUE"
  | "WEAKNESS"
  | "STRENGTH"
  | "ATTACK_STRATEGY"
  | "DEFENSE_STRATEGY"

/** The pill on a Legal Issues / Weaknesses / Strengths row — mirrors the API's FindingTag, and
 * FINDING_TAGS_BY_CATEGORY there decides which ones a category may use. */
export type FindingTag =
  | "CONTESTED"
  | "BRIEFING"
  | "OPEN"
  | "RESOLVED"
  | "MATERIAL"
  | "MINOR"
  | "CLOSED"
  | "STRONG"
  | "MODERATE"

/** Jev's check of a strength (USE_JEV_STRENGTHS) — stored in CaseFinding.jev. */
export interface StrengthJevCheck {
  support: "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"
  supportConfidence: number
  /** False when no text of the cited document was found — support was judged on the case data. */
  sourceRead: boolean
  /** 0..1 — how much of the case it carries. */
  weight: number
  weightConfidence: number
  rebuttal: "UNREBUTTED" | "REBUTTABLE" | "ALREADY_REBUTTED"
  rebuttalConfidence: number
  flags: "NOT_BORNE_OUT"[]
  uncertain: boolean
}

/** Jev's check of a weakness (USE_JEV_WEAKNESSES) — stored in CaseFinding.jev. */
export interface WeaknessJevCheck {
  support: "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"
  supportConfidence: number
  /** 0..1 — how much of the case it costs. */
  severity: number
  severityConfidence: number
  /** 0..1, where 1 is "usable against you straight away". */
  surfacing: number
  surfacingConfidence: number
  curable: "BY_EVIDENCE" | "BY_ARGUMENT" | "NOT_CURABLE"
  curableConfidence: number
  flags: "NOT_BORNE_OUT"[]
  uncertain: boolean
}

/** Jev's check of a legal issue (USE_JEV_LEGAL_ISSUES) — stored in CaseFinding.jev. */
export interface LegalIssueJevCheck {
  raised: "RAISED" | "NOT_RAISED"
  raisedConfidence: number
  contested: "CONTESTED" | "UNCONTESTED" | "UNCLEAR"
  contestedConfidence: number
  burden: BurdenParty
  burdenConfidence: number
  /** The drafting model's own burden call; null on lawyer-entered issues. */
  modelBurden: BurdenParty | null
  flags: ("NOT_RAISED" | "BURDEN_DISPUTED")[]
  uncertain: boolean
}

export type BurdenParty = "CLAIMANT" | "RESPONDENT" | "SHARED" | "UNCLEAR"

export interface CaseFinding {
  id: string
  caseId: string
  category: FindingCategory
  label: string
  notes: string | null
  /** Which source document an AI-generated finding is grounded in. Null for lawyer-entered
   * findings and for AI findings the model didn't attribute to a specific document. */
  sourceLabel: string | null
  /** Sub-line: who bears the burden, the work that would close it, or the document reference. */
  detail: string | null
  tag: FindingTag | null
  /** -10..10, the same scale as Red Team's argument impact. */
  impact: number | null
  position: number | null
  /** Jev's check (per-category shape). Null when Jev wasn't run or its call failed. */
  jev: Record<string, unknown> | null
  /** The drafting model's own tag/impact, kept once Jev has replaced them. */
  modelTag: FindingTag | null
  modelImpact: number | null
  jevCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

export type WitnessStatus = "READY" | "ADVERSE" | "OUTSTANDING"

export interface Witness {
  id: string
  caseId: string
  name: string
  role: string | null
  summary: string | null
  /** AI = found automatically in `sourceDocument`; `sourceQuote` is the verbatim line it came from. */
  source: "MANUAL" | "AI"
  sourceDocumentId: string | null
  sourceQuote: string | null
  sourceDocument: { id: string; name: string } | null
  status: WitnessStatus
  credibility: number
  /** AI-proposed — the displayed score is credibilityOverride ?? aiCredibility ?? credibility. */
  aiCredibility: number | null
  aiRationale: { text: string; source: string | null }[] | null
  aiSuggestedStatus: WitnessStatus | null
  credibilityOverride: number | null
  scoredAt: string | null
  statementDueOn: string | null
  statementReceived: boolean
  contact: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type DamageCategory =
  | "ACTUAL"
  | "MORAL"
  | "EXEMPLARY"
  | "ATTORNEYS_FEES"
  | "OTHER"

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
  /** Per-sentence source attribution for `narrative` only (not narrativeCourt/narrativeOpposing),
   * matched onto it at render time — see components/shared/attributed-text.tsx. Null when the
   * reconstruction predates this field, its [CLAIMS] block didn't parse, or narrative was
   * hand-edited since generation (a stale claim is cleared rather than risking a wrong match). */
  claims: AttributedClaim[] | null
  audioFileId: string | null
  audioFile: { id: string; fileUrl: string | null } | null
  audioStatus: string | null
  audioStaleAt: string | null
  // Grounded Reconstruction Rungs 1-2 (differentiation program, Phase 3) — see SceneDetail
  // below. `scenes` is null until CaseReconstructionSvc.generateScenes has run once.
  scenes: SceneDetail[] | null
  tableReadFileId: string | null
  tableReadFile: { id: string; fileUrl: string | null } | null
  tableReadStatus: string | null
  tableReadStaleAt: string | null
  createdAt: string
  updatedAt: string
}

// One beat of the reconstructed episode — time, place, who's there, what happens, any recorded
// dialogue, and where each element comes from. Every `sourceRefs` entry was already verified
// server-side (docId resolves to a real case document; a given quote actually appears in that
// document's sampled text — see case-reconstruction-scenes-parse.ts) before this ever reaches
// the app, so `verified` here is read-only, same contract as DecisionRecordPayload. A scene
// with no verified sources isn't dropped — it shows up in `unresolved` instead, and that same
// text is promoted server-side into a Weakness finding so the gap becomes investigation work.
export interface SceneDialogueLine {
  actor: string
  line: string
}

export interface SceneSourceRef {
  docId: string
  page: number | null
  quote: string | null
  verified: boolean
}

export interface SceneDetail {
  index: number
  time: string
  location: string
  actors: string[]
  action: string
  dialogue: SceneDialogueLine[]
  sourceRefs: SceneSourceRef[]
  confidence: "high" | "medium" | "low"
  unresolved: string[]
}

export interface AttributedClaim {
  text: string
  category: "GROUNDED" | "INFERENCE" | "UNSUPPORTED"
  sourceLabel: string | null
}

export type RedTeamArgumentStrength = "STRONG" | "MODERATE" | "WEAK"

export type RedTeamSourceKind =
  | "LEGAL_ISSUE"
  | "WEAKNESS"
  | "CONTRADICTION"
  | "TIMELINE"
  | "DOCUMENT"
  | "WITNESS"
  | "DAMAGE"
  | "PARTY"

export interface RedTeamArgument {
  title: string
  gist: string | null
  strength: RedTeamArgumentStrength
  /** -10..10; positive = moves the case toward the opponent. */
  impact: number
  reasoning: string | null
  source: { kind: RedTeamSourceKind; label: string }
  /** Jev's check of this argument against the case data (USE_JEV_REDTEAM). When present,
   * strength/impact are computed from it and the author model's own are in model*. Absent on
   * assessments made with the flag off; null when Jev's call failed for this argument. */
  jev?: RedTeamJevRating | null
  modelStrength?: RedTeamArgumentStrength
  modelImpact?: number
}

export interface RedTeamJevRating {
  support: "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"
  supportConfidence: number
  /** 0..1 */
  likelihood: number
  likelihoodConfidence: number
  /** 0..1 */
  severity: number
  severityConfidence: number
  uncertain: boolean
}

export interface RedTeamArguments {
  opponent: string | null
  riskOfLoss: number | null
  /** Highest impact first. */
  arguments: RedTeamArgument[]
}

export interface RedTeamAssessment {
  id: string
  caseId: string
  content: string
  /** Per-sentence source attribution, matched onto `content` at render time — see
   * components/shared/attributed-text.tsx. Null/empty on assessments generated before this
   * existed, or if the model's [CLAIMS] block didn't parse. */
  claims: AttributedClaim[] | null
  /** Ranked opposing arguments, each resolved to the case item it rests on. Null on assessments
   * generated before this existed, or if the model's [ARGUMENTS] block didn't parse. */
  arguments: RedTeamArguments | null
  createdAt: string
  updatedAt: string
}

// Decision Records (differentiation program, Phase 1) — the "Why?" behind one conclusion in a
// legal answer, already verified by chat-wonder-v2-api before it reaches this app: every
// `rule[].url` was checked against the sources actually retrieved that turn, every
// `evidence*[].docId` against the case's attached exhibits. This app never re-derives
// `verified` — see docs/plans/differentiation-program.md Workstream A.
export type DecisionStatus = "ACTIVE" | "DISPUTED" | "SUPERSEDED"

export interface DecisionRule {
  title: string
  url: string | null
  verified: boolean
}

export interface DecisionEvidence {
  doc: string
  docId: string | null
  pinpoint: string
  quote: string | null
  verified: boolean
}

export interface DecisionAlternative {
  position: string
  whyRejected: string
  evidenceRef: string | null
}

/** The audited record itself, exactly as chat-wonder produced it — stored verbatim in
 * DecisionRecord.payload and duplicated onto the row's `anchor` column for indexing/display. */
export interface DecisionRecordPayload {
  anchor: string
  conclusion: string
  rule: DecisionRule[]
  evidenceFor: DecisionEvidence[]
  evidenceAgainst: DecisionEvidence[]
  alternatives: DecisionAlternative[]
  weighting: string
  confidence: "high" | "medium" | "low"
  wouldChangeIf: string[]
}

/** The user turn that produced a decision, resolved server-side from sourceMessageId (the
 * assistant reply) back to its parent user message — see CaseSnapshotSvc.get. Null when the
 * source message was deleted or the record predates this lookup. */
export interface DecisionSourcePrompt {
  messageId: string
  consultationId: string
  content: string
  createdAt: string
}

export interface DecisionRecord {
  id: string
  caseId: string
  sourceMessageId: string | null
  anchor: string
  payload: DecisionRecordPayload
  status: DecisionStatus
  authorUserId: string | null
  disputeNote: string | null
  createdAt: string
  updatedAt: string
  sourcePrompt: DecisionSourcePrompt | null
}

// Case Theories & Annotations (differentiation program, Phase 2) — several lawyers can hold
// different theories of the same case side by side; the system never merges them. An
// `authorUserId` of null marks an AI-proposed starting point (CaseTheorySvc.propose) — adopted
// by forking it into your own copy, never by editing it in place. See
// docs/plans/differentiation-program.md Workstream B.
export type TheoryStatus = "DRAFT" | "ACTIVE" | "RETIRED"
export type TheoryStance = "ASSERTS" | "DENIES"

export interface TheoryClaim {
  id: string
  theoryId: string
  statement: string
  stance: TheoryStance
  graphNodeId: string | null
  createdAt: string
}

export interface TheoryAssumption {
  id: string
  theoryId: string
  statement: string
  createdAt: string
}

export interface TheoryOpenQuestion {
  id: string
  theoryId: string
  question: string
  createdAt: string
}

export interface CaseTheory {
  id: string
  caseId: string
  authorUserId: string | null
  title: string
  thesis: string
  status: TheoryStatus
  forkedFromId: string | null
  claims: TheoryClaim[]
  assumptions: TheoryAssumption[]
  openQuestions: TheoryOpenQuestion[]
  createdAt: string
  updatedAt: string
}

export interface TheoryDiffDivergence {
  claimA: string
  claimB: string
  decidingEvidence: string
  missing: string
}

export interface TheoryDiffResult {
  sharedClaims: string[]
  divergentClaims: TheoryDiffDivergence[]
}

export interface TheoryDiff {
  id: string
  caseId: string
  theoryAId: string
  theoryBId: string
  result: TheoryDiffResult
  createdAt: string
  updatedAt: string
}

export type AnnotationTargetType = "NODE" | "EDGE" | "DECISION" | "CHUNK"
export type AnnotationKind = "NOTE" | "DISPUTE" | "ALTERNATIVE_READING"

export interface Annotation {
  id: string
  caseId: string
  authorUserId: string | null
  targetType: AnnotationTargetType
  targetId: string
  kind: AnnotationKind
  body: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DeadlineRule {
  code: string
  label: string
  days: number
  ruleSource: string
}
